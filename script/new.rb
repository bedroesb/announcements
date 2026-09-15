#!/usr/bin/env ruby
# frozen_string_literal: true

# Scaffolds a new incident or announcement.
#
#   ruby script/new.rb incident "Storage is slow"
#   ruby script/new.rb announcement "New training series" --severity info
#
# Prints the path of the created file; edit it, commit it, open a pull request.

require "time"

USAGE = <<~TEXT
  Usage: ruby script/new.rb <incident|announcement> "Title" [--level KEY]

    --level KEY   incidents:     critical | degraded   (default: degraded)
                  announcements: maintenance | info    (default: info)
TEXT

args = ARGV.dup
kind = args.shift
title = args.shift

abort USAGE unless %w[incident announcement].include?(kind) && title && !title.strip.empty?

level = nil
until args.empty?
  flag = args.shift
  case flag
  when "--level", "-l" then level = args.shift
  else abort "Unknown option #{flag}\n\n#{USAGE}"
  end
end

field = kind == "incident" ? "severity" : "type"
level ||= kind == "incident" ? "degraded" : "info"

dir = kind == "incident" ? "_incidents" : "_announcements"
now = Time.now

slug = title.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|-\z/, "")[0, 50].sub(/-\z/, "")
path = File.join(File.expand_path("..", __dir__), dir, "#{now.strftime('%Y-%m-%d')}-#{slug}.md")

abort "#{path} already exists" if File.exist?(path)

offset = now.strftime("%:z")
stamp = now.strftime("%Y-%m-%d %H:%M:00 ") + offset

File.write(path, <<~MARKDOWN)
  ---
  title: #{title}
  start: #{stamp}
  # Add `end:` once it is over, in the same format as `start`.
  #{field}: #{level}
  services_affected:
    - # id from _data/services.yml
  summary: >-
    One or two sentences describing the impact.
  ---

  Describe what is happening, who is affected and what people can do in the
  meantime. Add a short resolution section once it is closed.
MARKDOWN

puts path
