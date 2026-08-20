---
permalink: /
title: "about me"
excerpt: "A brief introduction to me and my work, and current news."

#toc: true
---

Passionate about **theoretical physics and data methods**. My research interests lie in the area of *high energy physics, gravity, cosmology* and their intersection.

I hold a PhD in Physics from the LMU in Munich to **Enhance Exploitation of Data in High Energy Physics with Public Likelihoods**. 

Former intern at the [IAEA](https://www.iaea.org/), working on synergies between nuclear fission and nuclear fusion, to accelerate the availability of fusion power plants delivering electricity to the grid.

Active supporter of open source and open science.
Excited about climbing, mountaineering and fighting climate change.

---

## News

<ul>
{% for item in site.data.news %}
  <li><strong>{{ item.date | date: "%B %Y" }}</strong> &mdash; {% if item.link %}<a href="{{ item.link }}">{{ item.text }}</a>{% else %}{{ item.text }}{% endif %}</li>
{% endfor %}
</ul>
