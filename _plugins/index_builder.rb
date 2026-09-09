# frozen_string_literal: true

require "date"

# Builds the site's single index: one chronological, filterable register of
# every kind of work -- papers, talks, code, roles, places -- assembled from
# five sources into `site.data.index_entries`.
#
# Why a plugin rather than Liquid: merging the sources in a template needs
# `concat` plus `sort: "date"` across arrays whose dates are Ruby `Date`
# (parsed from _data/*.yml) and `Time` (from post front matter). Comparing
# those two is not reliably ordered, so the sort would silently misorder.
# Normalising here also keeps the templates free of per-source special cases.
#
# Note: Jekyll's `--safe` flag skips everything under `_plugins/` entirely,
# which would leave the index empty. This repo's build
# (.github/workflows/pages.yml) does not pass --safe, so this is a note for
# future maintainers, not current behaviour.
#
# `build` is pure -- it takes plain hashes and returns plain hashes, so it can
# be unit-tested without booting Jekyll (see test/index_builder_test.rb). The
# Jekyll::Generator at the bottom is only the adapter that feeds it.
module IndexBuilder
  # Order matters: it's the order the filter chips render in.
  #
  # `place` is deliberately not in WORK_KINDS: places restate work that is
  # already listed (the LMU place and the postdoc role are the same job), so
  # interleaving them into the default view duplicates it. The `places` chip
  # is a view switch instead -- it mounts the globe and shows only the place
  # rows. See assets/js/index-filter.js.
  WORK_KINDS = %w[paper talk project role].freeze
  KINDS = %w[paper talk project role place].freeze

  # Authors strings run to eight names or more; the index shows one line.
  MAX_AUTHORS = 3

  module_function

  # Sources are arrays of plain hashes with string keys. Returns the entries
  # newest first, numbered "01".."NN".
  def build(publications: [], talks: [], posts: [], roles: [], places: [])
    entries =
      publications.map { |p| from_publication(p) } +
      talks.map { |t| from_talk(t) } +
      posts.map { |p| from_post(p) } +
      roles.map { |r| from_role(r) } +
      places.map { |p| from_place(p) }

    # Descending by date. Title is the tiebreaker so the order is stable
    # across builds when two entries share a date (several roles do).
    entries.sort_by! { |e| [-e["epoch"], e["title"].to_s] }

    # Numbered per group, not across the whole list: the default view hides
    # places, so numbering all 50 together would leave visible gaps (01, 03,
    # 04...) for anyone without JavaScript. index-filter.js renumbers on every
    # filter change anyway; this only has to be right before it runs.
    number!(entries.reject { |e| e["kind"] == "place" })
    number!(entries.select { |e| e["kind"] == "place" })
    entries
  end

  def number!(group)
    group.each_with_index { |e, i| e["n"] = format("%02d", i + 1) }
  end

  # Seconds since the epoch for anything YAML or Jekyll hands us. Date and
  # Time do not compare with each other, so everything becomes an Integer.
  # DateTime must be tested before Date -- it is a subclass.
  def epoch(value)
    case value
    when Time     then value.to_i
    when DateTime then value.to_time.to_i
    when Date     then Time.utc(value.year, value.month, value.day).to_i
    when String   then epoch(Date.parse(value))
    else 0
    end
  rescue ArgumentError # unparseable string
    0
  end

  # "J. Albrecht, F. Bernlochner, M. Colonna, L. Gärtner, ..." -> first three
  # plus "et al.". Strings that already say "et al." are left alone.
  def short_authors(authors)
    return nil if authors.nil? || authors.empty?

    names = authors.split(", ")
    return authors if names.length <= MAX_AUTHORS

    "#{names.take(MAX_AUTHORS).join(', ')} et al."
  end

  def join_meta(*parts)
    joined = parts.compact.reject(&:empty?).join(" · ")
    joined.empty? ? nil : joined
  end

  def external?(href)
    !href.nil? && href.start_with?("http://", "https://")
  end

  # Every source funnels through this so an entry always has the same shape,
  # whichever list the template is iterating.
  def entry(kind:, date:, title:, meta:, href:, year: nil, extra: {})
    e = {
      "kind"     => kind,
      "label"    => kind.upcase,
      "epoch"    => epoch(date),
      "year"     => year || year_of(date),
      "title"    => title.to_s,
      "meta"     => meta,
      "href"     => href,
      "external" => external?(href)
    }
    e.merge!(extra)
    e
  end

  def year_of(date)
    epoch(date).zero? ? "" : Time.at(epoch(date)).utc.year.to_s
  end

  def from_publication(pub)
    entry(
      kind:  "paper",
      date:  pub["date"],
      title: pub["title"],
      meta:  join_meta(pub["venue"], short_authors(pub["authors"])),
      href:  pub["link"]
    )
  end

  def from_talk(talk)
    entry(
      kind:  "talk",
      date:  talk["date"],
      title: talk["title"],
      meta:  talk["venue"],
      href:  talk["link"]
    )
  end

  def from_post(post)
    entry(
      kind:  "project",
      date:  post["date"],
      title: post["title"],
      meta:  post["summary"],
      href:  post["url"]
    )
  end

  def from_role(role)
    entry(
      kind:  "role",
      date:  role["date"],
      year:  role["years"], # optional display override, e.g. "2022–25"
      title: role["title"],
      meta:  role["org"],
      href:  "/cv/"
    )
  end

  # Places are the one kind whose row is not primarily a link: clicking it
  # activates the `places` filter and focuses that point on the globe (see
  # assets/js/index-filter.js). The optional `link` rides along as a separate
  # external anchor, and lat/lon/body feed the globe itself.
  def from_place(place)
    entry(
      kind:  "place",
      date:  place["date"],
      year:  "",
      title: place["title"],
      meta:  place["where"],
      href:  nil,
      extra: {
        "lat"  => place["lat"],
        "lon"  => place["lon"],
        "body" => place["body"],
        "link" => place["link"]
      }
    )
  end
end

if defined?(Jekyll)
  # Adapter: turns Jekyll's objects into the plain hashes `build` expects, and
  # hangs the result off site.data for the templates.
  class IndexBuilderGenerator < Jekyll::Generator
    safe true
    priority :low

    SUMMARY_LIMIT = 100

    def generate(site)
      site.data["index_entries"] = IndexBuilder.build(
        publications: site.data["publications"] || [],
        talks:        site.data["talks"] || [],
        posts:        site.posts.docs.map { |doc| post_hash(doc) },
        roles:        site.data["roles"] || [],
        places:       site.data["places"] || []
      )
    end

    private

    def post_hash(doc)
      {
        "title"   => doc.data["title"],
        "date"    => doc.date,
        "url"     => doc.url,
        "summary" => summarize(doc)
      }
    end

    # First paragraph, tags stripped, clipped at a word boundary. Jekyll's
    # excerpt is HTML and posts open with links, so both need removing.
    def summarize(doc)
      text = doc.data["excerpt"].to_s.gsub(/<[^>]*>/, "").gsub(/\s+/, " ").strip
      return nil if text.empty?
      return text if text.length <= SUMMARY_LIMIT

      "#{text[0, SUMMARY_LIMIT].rpartition(' ').first}…"
    end
  end
end
