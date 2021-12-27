---
title:  "Background event classification for Belle II"
thumbnail: /assets/images/BGNNflowchard.png
---

In this project I used neural networks to classify *EvtGen* simulated data into signal, \\(B \to K^* \nu \bar{\nu} \\),  and background. The goal was to investigate the possibility of bypassing the expensive *Geant4* detector simulation and following analysis. This project was done in the realms of the Belle-II experiment, but is applicable to all of experimental particle physics. It was a very new direction in the collaboration, where I helped to develop one of the first convolutional neutral networks for classification. By restructuring the network layers and managing to constructively input additional data (such as the decay string), I managed to improve the accuracy by over 10% and set the groundwork for future contributions. The project is still ongoing and being constantly improved.

During this project I learned about neural networks, some common design practises and options for handling and pre-processing data. I used [Keras](https://keras.io/) and other parts of [Tensorflow](https://www.tensorflow.org/) to embed relevant data from the simulation and develop a convolutional neural network for classification of signal and background in particle collisions. Furthermore, I learned about the simulation side of particle physics and some details about general data handling.
