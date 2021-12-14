---
title:  "Circumbinary disk simulations"
thumbnail: /assets/images/cbd.out1.00086_temp.png
---


I simulate the gas disk of a binary star system to investigate temperature distributions and compare them to the specific physical system [IRAS 16293-2422 A](https://arxiv.org/pdf/2005.11954.pdf). I run a parallelized, static mesh refined simulation of the system using the magnetohydrodynamics code [Athena++](https://github.com/PrincetonUniversity/athena). To identify the relevant physical processes to be included in the simulation, I have adapted the original code to the specific needs. I have learned a lot about numerical solvers and mesh refinement. I run the code on the institute [cluster](https://docs.mpcdf.mpg.de/doc/computing/clusters/systems/ExtraterrestrialPhysics/MPE-CCAS.html) with [Slurm](https://slurm.schedmd.com/documentation.html). The output of the simulation then has to be analysed and visualised, for which I use Python specific tools.
