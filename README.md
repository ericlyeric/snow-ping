# snow-ping
A scheduled service that runs every Thursday and Sunday at 11:00AM. The service sends SMS alerts to a list of contacts about Cypress Mountain ski conditions.

- the using the http://www.weatherunlocked.com/ snow report API
- using nodemailer for sending gmail SMS
- using google sheets for configuration and as a database

example sms message:
```
Moderate snow
Fresh Snow: 5.800000000000001cm
Temp: -8'C (avg -9'C)
Feels: -14'C (avg -14'C)
Vis: 2km (avg 6km)
Snow: 81.2mm Rain: -2.2mm
```
