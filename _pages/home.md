---
permalink: /
title: "about me"
excerpt: "A brief introduction to me and my work, and current news."

#toc: true
---

Hi!

I currently work on **data analytics methods and statistics in particle physics**. My research focusses on accelerating science, bringing us new breakthroughs faster.

I hold a PhD in Physics from the LMU in Munich, I have worked in the German parliament as scientific advisor, and at the [International Atomic Energy Agency](https://www.iaea.org/).

In my free time, I get excited about brainstorming how to deal with the impact of AI, fighting climate change, travelling, climbing and mountaineering.

---

## News

<ul>
{% for item in site.data.news %}
  <li><strong>{{ item.date | date: "%B %Y" }}</strong> &mdash; {% if item.link %}<a href="{{ item.link }}">{{ item.text }}</a>{% else %}{{ item.text }}{% endif %}</li>
{% endfor %}
</ul>

<script type="text/javascript"
        src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.0/MathJax.js?config=TeX-AMS_CHTML"></script>
