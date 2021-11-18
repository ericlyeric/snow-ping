require('dotenv').config();
var axios = require('axios');
var nodemailer = require('nodemailer');
var { google } = require('googleapis');
var testData = require('./example-response.json');

async function getSkiResortData() {
    const response = await axios.get(`${process.env.BASE_URL}/resortforecast/${process.env.RESORT_ID}?hourly_interval=${process.env.HOURLY_INTERVAL}&num_of_days=${process.env.NUM_OF_DAYS}&app_id=${process.env.APP_ID}&app_key=${process.env.APP_KEY}`)
    return response.data;
}

function parseSkiResortData(data) {
    const name = data.name;
    let startDate = parseDate(data.forecast[0].date);
    let endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 2).toString();

    startDate = startDate.toLocaleDateString();
    endDate = endDate.toLocaleDateString();

    let forecast = [];
    for (let i = 0; i < data.forecast.length; i++) {
        forecast.push({
            date: parseDate(data.forecast[i].date).toLocaleDateString(),
            time: data.forecast[i].time,
            weather: data.forecast[i].base.wx_desc,
            fresh_snow: data.forecast[i].base.freshsnow_cm,
            temp: data.forecast[i].base.temp_c,
            temp_avg: data.forecast[i].base.temp_avg_c,
            feelslike: data.forecast[i].base.feelslike_c,
            feelslike_avg: data.forecast[i].base.feelslike_avg_c,
            rain: data.forecast[i].rain_mm,
            snow: data.forecast[i].snow_mm,
            visability: data.forecast[i].vis_min_km,
            visability_avg: data.forecast[i].vis_avg_km,
        })
    }

    return {
        name,
        startDate,
        endDate,
        forecast
    }
}


function emailConfig({subject, recipients, body}) {
    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASSWORD 
        }
    });
    
    const mailOptions = {
        from: process.env.EMAIL_SERVICE,
        to: recipients,
        subject: subject,
        html: body
    };
    return {transporter, mailOptions}
}

async function composeEmail(data) {
    const subject = `${data.name}-${data.startDate}-${data.endDate}`
    const contacts = await getContacts();
    const emailBody = buildEmail(data.forecast);
    const {transporter, mailOptions} = emailConfig({subject: subject, recipients: contacts, body: emailBody});
    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
            console.log(`Accpeted: ${info.accepted}, Rejected: ${info.rejected}, Pending: ${info.pending}`)
        }
    })
}

function buildEmail(data) {
    let body = "";
    for (let i = 0; i < data.length; i++) {
        body += `<p>${data[i].date}-${data[i].time}-${data[i].weather}<br>`;
        body += `Temp: ${data[i].temp}'C (avg ${data[i].temp_avg}'C)  Fresh Snow: ${data[i].fresh_snow}cm<br>`;
        body += `Feelslike: ${data[i].feelslike}'C (avg ${data[i].feelslike_avg}'C)<br>`;
        body += `Visability: ${data[i].visability}km (avg ${data[i].visability_avg}km)<br>`;
        body += `Snow: ${data[i].snow}mm  Rain: ${data[i].rain}mm<br>`;
        body += `</p>`;
    }
    return body;
}

async function getContacts() {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json",
        scopes: "https://www.googleapis.com/auth/spreadsheets"
    });

    const client = await auth.getClient();
    const googleSheets = google.sheets({version: "v4", auth: client})    

    const getData = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: "contacts!G2:G102"
    })

    console.log(`Grabbed data rows: ${getData.data.range}`);
    console.log(`Grabbed contacts: ${getData.data.values}`);
    return getData.data.values;
}

function parseDate(date) {
    const dateParts = date.split("/");
    return new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
}

async function main() {
    console.log("Grabbing ski resort data ...");
    const data = await getSkiResortData();
    console.log("Got ski resort data");

    console.log("Parsing ski resort data ...");
    const parsedData = parseSkiResortData(data);
    console.log("Finshed parsing data");

    console.log("Composing email");
    composeEmail(parsedData);
    console.log("Done")   
}

main();