# frozen_string_literal: true

require "minitest/autorun"
require "date"
require_relative "../_plugins/index_builder"

class IndexBuilderTest < Minitest::Test
  # The core reason this lives in Ruby rather than Liquid: _data/*.yml yields
  # Date, post front matter yields Time, and the two do not sort together.
  def test_orders_newest_first_across_mixed_date_and_time_sources
    entries = IndexBuilder.build(
      publications: [{ "title" => "middle", "date" => Date.new(2025, 6, 1) }],
      posts:        [{ "title" => "newest", "date" => Time.utc(2026, 1, 1) }],
      roles:        [{ "title" => "oldest", "date" => Date.new(2018, 1, 1) }]
    )

    assert_equal %w[newest middle oldest], entries.map { |e| e["title"] }
  end

  def test_numbers_are_contiguous_and_zero_padded
    entries = IndexBuilder.build(
      talks: (1..11).map { |i| { "title" => "t#{i}", "date" => Date.new(2020, 1, i) } }
    )

    assert_equal "01", entries.first["n"]
    assert_equal "11", entries.last["n"]
    assert_equal (1..11).map { |i| format("%02d", i) }, entries.map { |e| e["n"] }
  end

  def test_entries_sharing_a_date_are_ordered_by_title_for_a_stable_build
    dated = ->(title) { { "title" => title, "date" => Date.new(2025, 1, 1) } }
    entries = IndexBuilder.build(roles: [dated["Zeta"], dated["Alpha"], dated["Mu"]])

    assert_equal %w[Alpha Mu Zeta], entries.map { |e| e["title"] }
  end

  def test_http_links_are_external_and_site_paths_are_not
    entries = IndexBuilder.build(
      publications: [{ "title" => "doi", "date" => Date.new(2026, 1, 1), "link" => "https://doi.org/x" }],
      posts:        [{ "title" => "post", "date" => Time.utc(2025, 1, 1), "url" => "/bibspire/" }]
    )

    assert_equal true, entries[0]["external"]
    assert_equal false, entries[1]["external"]
  end

  def test_missing_link_yields_no_href_and_is_not_external
    entry = IndexBuilder.build(talks: [{ "title" => "unlinked", "date" => Date.new(2024, 1, 1) }]).first

    assert_nil entry["href"]
    assert_equal false, entry["external"]
  end

  def test_long_author_lists_are_truncated_but_short_ones_are_kept_whole
    assert_equal "A. One, B. Two, C. Three et al.",
                 IndexBuilder.short_authors("A. One, B. Two, C. Three, D. Four, E. Five")
    assert_equal "A. One, B. Two", IndexBuilder.short_authors("A. One, B. Two")
    assert_nil IndexBuilder.short_authors(nil)
  end

  def test_publication_meta_joins_venue_and_authors_and_drops_a_missing_one
    with_both = IndexBuilder.from_publication(
      "title" => "t", "date" => Date.new(2026, 1, 1),
      "venue" => "Phys. Rev. D 114, 032003", "authors" => "L. Gärtner, N. Krug"
    )
    venue_only = IndexBuilder.from_publication("title" => "t", "venue" => "EPJC")

    assert_equal "Phys. Rev. D 114, 032003 · L. Gärtner, N. Krug", with_both["meta"]
    assert_equal "EPJC", venue_only["meta"]
  end

  def test_roles_display_a_year_range_when_given_one_and_the_date_year_otherwise
    ranged = IndexBuilder.from_role("title" => "phd", "date" => Date.new(2022, 1, 1), "years" => "2022–25")
    plain  = IndexBuilder.from_role("title" => "msc", "date" => Date.new(2020, 1, 1))

    assert_equal "2022–25", ranged["year"]
    assert_equal "2020", plain["year"]
  end

  def test_places_carry_their_coordinates_through_for_the_globe
    entry = IndexBuilder.from_place(
      "title" => "CERN", "where" => "Geneva", "lat" => 46.2333, "lon" => 6.0557,
      "date" => Date.new(2024, 1, 1), "body" => "Taught at iCSC"
    )

    assert_equal 46.2333, entry["lat"]
    assert_equal 6.0557, entry["lon"]
    assert_equal "Geneva", entry["meta"]
    assert_equal "", entry["year"], "places are undated in the index's year column"
  end

  def test_unparseable_or_missing_dates_sort_last_rather_than_raising
    entries = IndexBuilder.build(
      talks: [{ "title" => "dated", "date" => Date.new(2020, 1, 1) },
              { "title" => "undated" },
              { "title" => "garbage", "date" => "not a date" }]
    )

    assert_equal "dated", entries.first["title"]
    assert_equal %w[garbage undated], entries.drop(1).map { |e| e["title"] }
  end

  def test_posts_are_projects_not_code_several_are_theses_or_write_ups
    assert_equal "project", IndexBuilder.from_post("title" => "t")["kind"]
    assert_equal "PROJECT", IndexBuilder.from_post("title" => "t")["label"]
  end

  def test_places_are_excluded_from_the_default_work_kinds
    refute_includes IndexBuilder::WORK_KINDS, "place"
    assert_equal %w[paper talk project role], IndexBuilder::WORK_KINDS
  end

  def test_work_rows_and_place_rows_are_numbered_as_separate_sequences
    entries = IndexBuilder.build(
      talks:  [{ "title" => "t1", "date" => Date.new(2026, 1, 1) },
               { "title" => "t2", "date" => Date.new(2024, 1, 1) }],
      places: [{ "title" => "p1", "date" => Date.new(2025, 1, 1) },
               { "title" => "p2", "date" => Date.new(2023, 1, 1) }]
    )
    by_kind = entries.group_by { |e| e["kind"] }

    assert_equal %w[01 02], by_kind["talk"].map { |e| e["n"] }
    assert_equal %w[01 02], by_kind["place"].map { |e| e["n"] },
                 "places restart at 01 -- they are hidden from the default view"
  end

  def test_iso_date_strings_are_accepted
    assert_equal Time.utc(2026, 4, 1).to_i, IndexBuilder.epoch("2026-04-01")
  end
end
