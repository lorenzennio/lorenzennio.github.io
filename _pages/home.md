---
permalink: /
title: "About Me"
excerpt: "A brief introduction to me and my work, and current news."

#toc: true
---

Hi!

I currently work on **data analytics methods and statistics in particle physics**. My research focusses on [accelerating science](https://arxiv.org/abs/2606.22215), bringing us new breakthroughs faster.

I hold a PhD in Physics from the LMU in Munich, I have worked in the German parliament as scientific advisor, and at the [International Atomic Energy Agency](https://www.iaea.org/).

In my free time, I get excited about brainstorming how to deal with the impact of AI, fighting climate change, travelling, climbing and mountaineering.

---

## News

<ul>
{% for item in site.data.news %}
  <li>
    <span style="display: flex; align-items: baseline;">
      <span style="flex: 0 0 auto; white-space: nowrap;">{{ item.date | date: "%B %Y" }}</span>
      <span style="flex: 1 1 auto; min-width: 1em; margin: 0 0.5em 0.3em; border-bottom: 1px dashed;"></span>
      <span style="min-width: 0;">{{ item.text }}</span>
    </span>
  </li>
{% endfor %}
</ul>

<script type="text/javascript"
        src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.0/MathJax.js?config=TeX-AMS_CHTML"></script>
