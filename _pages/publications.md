---
title: "Publications & Talks"
permalink: /publications/
layout: single
author_profile: true
---

## Publications

<ul>
{% for pub in site.data.publications %}
  <li>
    <strong>{{ pub.title }}</strong><br>
    {{ pub.authors }}, <em>{{ pub.venue }}</em> ({{ pub.date | date: "%Y" }})
    {% if pub.link %} &mdash; <a href="{{ pub.link }}">link</a>{% endif %}
  </li>
{% endfor %}
</ul>

## Public Talks

<ul>
{% for talk in site.data.talks %}
  <li>
    <strong>{{ talk.title }}</strong><br>
    {{ talk.venue }}{% if talk.date %} ({{ talk.date | date: "%Y" }}){% endif %}
    {% if talk.link %} &mdash; <a href="{{ talk.link }}">link</a>{% endif %}
  </li>
{% endfor %}
</ul>

<script type="text/javascript"
        src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.0/MathJax.js?config=TeX-AMS_CHTML"></script>
