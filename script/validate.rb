#!/usr/bin/env ruby
# frozen_string_literal: true

# Checks every incident/announcement against the controlled vocabularies in
# _data/. Runs on every pull request; run it locally with:
#
#   ruby script/validate.rb        (or: npm run validate)

require "yaml"
require "date"

ROOT = File.expand_path("..", __dir__)
FILENAME_RE = /\A\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md\z/.freeze

# Incidents carry a `severity:`, announcements carry a `type:`. Which values
# are allowed for each comes from `applies_to` in _data/levels.yml.
COLLECTIONS = {
  "_incidents" => { kind: "incident", field: "severity" },
  "_announcements" => { kind: "announcement", field: "type" },
}.freeze

def load_yaml(text)
  YAML.safe_load(text, permitted_classes: [Date, Time], aliases: true)
end

levels = load_yaml(File.read(File.join(ROOT, "_data", "levels.yml")))
services = load_yaml(File.read(File.join(ROOT, "_data", "services.yml")))
service_ids = services.map { |s| s["id"] }

errors = []
warnings = []
count = 0

def timestamp?(value)
  value.is_a?(Time) || value.is_a?(DateTime) || value.is_a?(Date)
end

def to_time(value)
  value.to_time
end

COLLECTIONS.each do |dir, config|
  path = File.join(ROOT, dir)
  next unless Dir.exist?(path)

  kind = config[:kind]
  field = config[:field]
  other_field = field == "severity" ? "type" : "severity"
  allowed = levels.select { |_, v| v["applies_to"] == kind }.keys
  known_keys = %w[title start end services_affected summary updates layout kind] + [field]

  Dir.glob(File.join(path, "*.md")).sort.each do |file|
    rel = file.sub("#{ROOT}/", "")
    count += 1
    err = ->(msg) { errors << "#{rel}: #{msg}" }
    warn_ = ->(msg) { warnings << "#{rel}: #{msg}" }

    basename = File.basename(file)
    warn_.call("filename should look like YYYY-MM-DD-short-slug.md") unless basename.match?(FILENAME_RE)

    raw = File.read(file)
    match = raw.match(/\A---\s*\n(.*?)\n---\s*(\n|\z)/m)
    unless match
      err.call("no YAML front matter found (the file must start with ---)")
      next
    end

    begin
      fm = load_yaml(match[1])
    rescue Psych::Exception => e
      err.call("front matter is not valid YAML: #{e.message}")
      next
    end

    unless fm.is_a?(Hash)
      err.call("front matter must be a mapping of key: value pairs")
      next
    end

    # --- title -------------------------------------------------------------
    title = fm["title"]
    err.call("`title` is required") if title.nil? || title.to_s.strip.empty?
    warn_.call("`title` is very long (#{title.to_s.length} chars), keep it under 90") if title.to_s.length > 90

    # --- start / end -------------------------------------------------------
    start = fm["start"]
    if start.nil?
      err.call("`start` is required")
    elsif !timestamp?(start)
      err.call("`start` must be an unquoted date-time, e.g. 2026-09-14 08:20:00 +02:00 (got #{start.class})")
    end

    finish = fm["end"]
    if !finish.nil? && !timestamp?(finish)
      err.call("`end` must be an unquoted date-time, e.g. 2026-09-14 18:00:00 +02:00 (got #{finish.class})")
    elsif timestamp?(start) && timestamp?(finish) && to_time(finish) < to_time(start)
      err.call("`end` (#{finish}) is before `start` (#{start})")
    end

    # --- severity / type ---------------------------------------------------
    if fm.key?(other_field)
      err.call("`#{other_field}` belongs to the other collection; #{dir} uses `#{field}`")
    end

    value = fm[field]
    if value.nil?
      err.call("`#{field}` is required, one of: #{allowed.join(', ')}")
    elsif !allowed.include?(value.to_s)
      hint = levels.key?(value.to_s) ? " (`#{value}` only applies to #{levels[value.to_s]['applies_to']}s)" : ""
      err.call("unknown #{field} `#{value}`#{hint}, use one of: #{allowed.join(', ')}")
    end

    # --- services ----------------------------------------------------------
    affected = fm["services_affected"]
    if affected.nil? || (affected.respond_to?(:empty?) && affected.empty?)
      if kind == "incident"
        err.call("`services_affected` is required and must list at least one service")
      else
        warn_.call("`services_affected` is empty; add a service so the announcement is filterable")
      end
    elsif !affected.is_a?(Array)
      err.call("`services_affected` must be a list, e.g. [storage, galaxy]")
    else
      affected.each do |id|
        if id.nil? || id.to_s.strip.empty?
          err.call("`services_affected` has an empty entry - fill in a service id or remove the line")
        elsif !service_ids.include?(id.to_s)
          err.call("unknown service `#{id}` - add it to _data/services.yml or use one of: #{service_ids.join(', ')}")
        end
      end
      dupes = affected.tally.select { |_, n| n > 1 }.keys
      warn_.call("duplicate services listed: #{dupes.join(', ')}") if dupes.any?
    end

    # --- summary -----------------------------------------------------------
    summary = fm["summary"]
    if summary.nil? || summary.to_s.strip.empty?
      warn_.call("no `summary`: the card on the status page will only show the title")
    elsif summary.to_s.length > 300
      warn_.call("`summary` is long (#{summary.to_s.length} chars); it is meant to be one or two sentences")
    end

    # --- updates -----------------------------------------------------------
    updates = fm["updates"]
    if updates
      if !updates.is_a?(Array)
        err.call("`updates` must be a list")
      else
        updates.each_with_index do |u, i|
          label = "updates[#{i}]"
          unless u.is_a?(Hash)
            err.call("#{label} must be a mapping with `time` and `body`")
            next
          end
          err.call("#{label}.time must be an unquoted date-time") unless timestamp?(u["time"])
          err.call("#{label}.body is required") if u["body"].to_s.strip.empty?
          if timestamp?(start) && timestamp?(u["time"]) && to_time(u["time"]) < to_time(start)
            warn_.call("#{label}.time is before the start of the entry")
          end
        end
      end
    end

    # --- body --------------------------------------------------------------
    body = raw[match.end(0)..].to_s.strip
    warn_.call("the body is empty; describe impact and resolution") if body.empty?

    (fm.keys - known_keys - [other_field]).each do |key|
      warn_.call("unknown front matter key `#{key}` (ignored when rendering)")
    end
  end
end

puts "Checked #{count} entr#{count == 1 ? 'y' : 'ies'} in #{COLLECTIONS.keys.join(' and ')}."

unless warnings.empty?
  puts "\nWarnings (#{warnings.size}):"
  warnings.each { |w| puts "  ! #{w}" }
end

if errors.empty?
  puts "\nAll good."
  exit 0
end

puts "\nErrors (#{errors.size}):"
errors.each { |e| puts "  x #{e}" }
exit 1
