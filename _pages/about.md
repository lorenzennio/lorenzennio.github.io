---
permalink: /
title: "Lorenz Gärtner"
layout: page
math: true
---

<img class="portrait" src="{{ site.author.avatar | relative_url }}" alt="Lorenz Gärtner">

I currently work on **data analytics methods and statistics in particle physics**. My research focusses on [accelerating science](https://arxiv.org/abs/2606.22215), bringing us new breakthroughs faster.

I hold a PhD in Physics from the LMU in Munich, I have worked in the German parliament as scientific advisor, and at the [International Atomic Energy Agency](https://www.iaea.org/).

In my free time, I get excited about brainstorming how to deal with the impact of AI, fighting climate change, travelling, climbing and mountaineering.

## News

<ul class="news">
{% for item in site.data.news %}
  <li class="news__item">
    <span class="news__date">{{ item.date | date: "%b %Y" }}</span>
    <span class="news__text">{{ item.text }}</span>
  </li>
{% endfor %}
</ul>
