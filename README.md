# ee596_tinyML_project
Final Project Repository

## Introduction
The purpose of this project was to implement tinyML on the Arduino Nano BLE Sense to recognize gestures to control an IoT device.

## Gestures and Model
Using a simple Convolutional Neural Network, we trained the model to recognize the following gestures:
- 0: Swipe Up
- 1: Swipe Down
- 2: Hand Wave
- 3: Clockwise
- 4: Counter-clockwise

The model was then compressed using Integer Quantization and uploaded into the Arduino Nano BLE Sense.
The data set is located in `Implementation_based_on_Lab_6/gestures_data`.\n
Data processing, model training and quantization, and model evaluation can be found in `Project_Gestures.ipynb`.

## API Integration
This IoT device for this project was the Philips Hue Light Bulb with the HUE Hub. Ref: https://developers.meethue.com/develop/get-started-2/
The Arduino Nano BLE Sense is connected to a webpage via BLE. The webpage, `index.html` reads the Stroke and Model Prediction data from the Arduino and controls the light via API calls. The following the is the logic programmed:
- 0: Swipe Up - Turn light on
- 1: Swipe Down - Turn light off
- 2: Hand Wave - None
- 3: Clockwise - Turn light on and brighten
- 4: Counter-clockwise - Turn light on and dim

## Implementation
To implement this project:
- Download the `index.html`,  `project_gestures.js` and the files in `project_gestures_arduino_files`.
- Upload the Arduino files to your Arduino Nano BLE Sense.
- In the `project_gestures.js`, replace `<bridge-ip>` and `username` in the `API_ENDPOINT_URL` value for your HUE Hub.
- Connect your Arduino in the `index.html` webpage by clicking the Bluetooth button
- Start your gestures and see the results on the webpage!
