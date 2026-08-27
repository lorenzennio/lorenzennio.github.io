# frozen_string_literal: true

# Merges the compiled dark and light theme stylesheets into one, replacing
# the color values that differ between skins with CSS custom properties.
# See docs/superpowers/specs/2026-08-27-theme-css-merge-design.md.
#
# main.css (dark) and main-light.css (light) are ~90% identical compiled
# output from the same Sass partials -- only a couple dozen color literals
# differ. Rather than shipping both stylesheets and swapping which one is
# linked at runtime, this rewrites main.css in place with `var(--tv-N)` in
# place of the differing literals, appends the two small variable blocks
# after the rewritten rules, and (via the Jekyll hook below) drops
# main-light.css from the build output entirely.
#
# Note: Jekyll's `--safe` flag skips loading everything under `_plugins/`
# entirely, which would silently ship unmerged main.css/main-light.css with
# a non-functional [data-theme] toggle. This repo's build
# (.github/workflows/pages.yml) does not pass --safe, so this is a
# documentation note for future maintainers, not current behavior.
module ThemeCssMerge
  # Matches a CSS color literal: #hex, rgb()/rgba(), or hsl()/hsla().
  COLOR_PATTERN = /
    \#[0-9a-fA-F]{3,8}\b
    | hsla?\([^)]*\)
    | rgba?\([^)]*\)
  /x.freeze

  SOURCEMAP_COMMENT = %r{/\*# sourceMappingURL=[^*]*\*/\s*\z}.freeze

  StructuralMismatch = Class.new(StandardError)

  Segment = Struct.new(:kind, :value) # kind is :text or :color

  # Tokenizes CSS into alternating text/color segments.
  def self.tokenize(css)
    segments = []
    pos = 0
    css.scan(COLOR_PATTERN) do
      m = Regexp.last_match
      segments << Segment.new(:text, css[pos...m.begin(0)])
      segments << Segment.new(:color, m[0])
      pos = m.end(0)
    end
    segments << Segment.new(:text, css[pos..])
    segments
  end

  def self.strip_sourcemap_comment(css)
    css.sub(SOURCEMAP_COMMENT, "")
  end

  # Merges dark_css and light_css into a single stylesheet. Raises
  # StructuralMismatch if the two differ in anything other than color
  # literals and the trailing sourcemap comment.
  def self.merge(dark_css, light_css)
    dark_segments = tokenize(strip_sourcemap_comment(dark_css))
    light_segments = tokenize(strip_sourcemap_comment(light_css))

    if dark_segments.length != light_segments.length
      raise StructuralMismatch,
            "dark and light stylesheets tokenize into a different number " \
            "of segments (#{dark_segments.length} vs #{light_segments.length}) " \
            "-- they diverge in more than just color values"
    end

    var_names = {} # [dark_value, light_value] => "--tv-N"
    merged_parts = []

    dark_segments.zip(light_segments).each do |dark_seg, light_seg|
      if dark_seg.kind != light_seg.kind
        raise StructuralMismatch,
              "segment kind mismatch: #{dark_seg.kind} vs #{light_seg.kind}"
      end

      if dark_seg.kind == :text
        if dark_seg.value != light_seg.value
          raise StructuralMismatch,
                "non-color text differs between dark and light stylesheets: " \
                "#{dark_seg.value.inspect} vs #{light_seg.value.inspect}"
        end
        merged_parts << dark_seg.value
      elsif dark_seg.value == light_seg.value
        merged_parts << dark_seg.value
      else
        key = [dark_seg.value, light_seg.value]
        var_names[key] ||= "--tv-#{var_names.size}"
        merged_parts << "var(#{var_names[key]})"
      end
    end

    return merged_parts.join if var_names.empty?

    root_block = var_names.map { |(dark_v, _light_v), name| "#{name}:#{dark_v}" }.join(";")
    light_block = var_names.map { |(_dark_v, light_v), name| "#{name}:#{light_v}" }.join(";")

    "#{merged_parts.join}:root{#{root_block}}[data-theme=\"light\"]{#{light_block}}"
  end
end

if defined?(Jekyll)
  Jekyll::Hooks.register(:site, :post_write) do |site|
    css_dir = File.join(site.dest, "assets", "css")
    dark_path = File.join(css_dir, "main.css")
    light_path = File.join(css_dir, "main-light.css")

    dark_exists = File.exist?(dark_path)
    light_exists = File.exist?(light_path)

    if dark_exists != light_exists
      raise ThemeCssMerge::StructuralMismatch,
            "expected both #{dark_path} and #{light_path} to exist, but only " \
            "#{dark_exists ? dark_path : light_path} does -- can't merge a single stylesheet"
    end

    next unless dark_exists && light_exists

    merged = ThemeCssMerge.merge(File.read(dark_path), File.read(light_path))
    File.write(dark_path, merged)

    [light_path, "#{light_path}.map", "#{dark_path}.map"].each do |path|
      File.delete(path) if File.exist?(path)
    end
  end
end
