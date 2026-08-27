# frozen_string_literal: true

require "minitest/autorun"
require_relative "../_plugins/theme_css_merge"

class ThemeCssMergeTest < Minitest::Test
  def test_identical_stylesheets_produce_unchanged_output_with_no_variables
    css = "body{color:#333;margin:0}"
    assert_equal css, ThemeCssMerge.merge(css, css)
  end

  def test_single_differing_hex_color_becomes_a_css_variable
    dark = "body{color:#08172e}"
    light = "body{color:#ddd8b8}"
    expected = ':root{--tv-0:#08172e}[data-theme="light"]{--tv-0:#ddd8b8}' \
               "body{color:var(--tv-0)}"
    assert_equal expected, ThemeCssMerge.merge(dark, light)
  end

  def test_repeated_same_color_pair_reuses_the_same_variable
    dark = "a{color:#08172e}b{color:#08172e}"
    light = "a{color:#ddd8b8}b{color:#ddd8b8}"
    expected = ':root{--tv-0:#08172e}[data-theme="light"]{--tv-0:#ddd8b8}' \
               "a{color:var(--tv-0)}b{color:var(--tv-0)}"
    assert_equal expected, ThemeCssMerge.merge(dark, light)
  end

  def test_identical_color_occurring_in_both_stays_a_literal
    dark = "a{color:#3b5998;background:#08172e}"
    light = "a{color:#3b5998;background:#ddd8b8}"
    expected = ':root{--tv-0:#08172e}[data-theme="light"]{--tv-0:#ddd8b8}' \
               "a{color:#3b5998;background:var(--tv-0)}"
    assert_equal expected, ThemeCssMerge.merge(dark, light)
  end

  def test_rgb_and_hsl_color_functions_are_detected
    dark = "a{color:rgb(1,2,3)}b{color:hsla(1,2%,3%,.5)}"
    light = "a{color:rgb(4,5,6)}b{color:hsla(7,8%,9%,.5)}"
    expected = ':root{--tv-0:rgb(1,2,3);--tv-1:hsla(1,2%,3%,.5)}' \
               '[data-theme="light"]{--tv-0:rgb(4,5,6);--tv-1:hsla(7,8%,9%,.5)}' \
               "a{color:var(--tv-0)}b{color:var(--tv-1)}"
    assert_equal expected, ThemeCssMerge.merge(dark, light)
  end

  def test_multiple_distinct_variable_pairs_get_distinct_names_in_first_seen_order
    dark = "a{color:#111;background:#222}"
    light = "a{color:#333;background:#444}"
    merged = ThemeCssMerge.merge(dark, light)
    assert_includes merged, "--tv-0:#111"
    assert_includes merged, "--tv-1:#222"
    assert_includes merged, "a{color:var(--tv-0);background:var(--tv-1)}"
  end

  def test_raises_on_non_color_text_mismatch
    dark = "a{color:#333}"
    light = "a{background:#333}"
    assert_raises(ThemeCssMerge::StructuralMismatch) do
      ThemeCssMerge.merge(dark, light)
    end
  end

  def test_sourcemap_comment_difference_is_ignored_and_stripped
    dark = "a{color:#333}\n/*# sourceMappingURL=main.css.map */"
    light = "a{color:#333}\n/*# sourceMappingURL=main-light.css.map */"
    assert_equal "a{color:#333}\n", ThemeCssMerge.merge(dark, light)
  end
end
