require('dotenv').config();
var axios = require('axios');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var { google } = require('googleapis');
var { JWT } = require('google-auth-library');

const designatedTime = '11:00';

async function getSkiResortData() {
  const response = await axios.get(
    `${process.env.BASE_URL}/resortforecast/${process.env.RESORT_ID}?hourly_interval=${process.env.HOURLY_INTERVAL}&num_of_days=${process.env.NUM_OF_DAYS}&app_id=${process.env.APP_ID}&app_key=${process.env.APP_KEY}`
  );
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
    // only want the morning date, don't want to check the physical date
    if (data.forecast[i].time === designatedTime) {
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
      });
    }
  }

  return {
    name,
    startDate,
    endDate,
    forecast,
  };
}

function emailConfig({ subject, recipients, body }) {
  const smtpConfig = {
    service: process.env.EMAIL_SERVICE,
    host: process.env.EMAIL_HOST,
    port: process.env.SMPT_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  };
  const transporter = nodemailer.createTransport(smtpTransport(smtpConfig));

  const mailOptions = {
    from: process.env.EMAIL_SERVICE,
    to: recipients,
    subject: subject,
    html: body,
  };
  return { transporter, mailOptions };
}

async function composeEmail(data) {
  const contacts = await getContacts();
  // sent seperate messages, @ designated time, could not meet 160 character limit
  for (let i = 0; i < data.forecast.length; i++) {
    const subject = `${data.forecast[i].date}-${data.forecast[i].time}`;
    const emailBody = buildEmail(data.forecast[i]);
    const { transporter, mailOptions } = emailConfig({
      subject: subject,
      recipients: contacts,
      body: emailBody,
    });
    console.log('email configged');
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
        console.log(
          `Accpeted: ${info.accepted}, Rejected: ${info.rejected}, Pending: ${info.pending}`
        );
      }
    });
  }
}

function buildEmail(data) {
  body = `<p>${data.weather}<br>
Fresh Snow: ${data.fresh_snow}cm<br>
Temp: ${data.temp}'C (avg ${data.temp_avg}'C)<br>
Feels: ${data.feelslike}'C (avg ${data.feelslike_avg}'C)<br>
Vis: ${data.visability}km (avg ${data.visability_avg}km)<br>
Snow: ${data.snow}mm  Rain: ${data.rain}mm<br>
</p>`;
  return body;
}

async function getContacts() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const auth = new JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: process.env.GOOGLE_SCOPES,
  });
  const googleSheets = google.sheets({ version: 'v4', auth: auth });

  const getData = await googleSheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: 'contacts!H:I',
  });

  console.log(`Grabbed data column: ${getData.data.range}`);
  console.log(`Grabbed contacts: ${getData.data.values}`);
  getData.data.values.shift();
  return getData.data.values;
}

function parseDate(date) {
  const dateParts = date.split('/');
  return new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
}

async function main() {
  let date = new Date().getDay();
  // send on Sundays and Thursdays
  if (date === 0 || date === 4) {
    console.log('Grabbing ski resort data ...');
    const data = await getSkiResortData();
    console.log('Got ski resort data');

    console.log('Parsing ski resort data ...');
    const parsedData = parseSkiResortData(data);
    console.log('Finshed parsing data');

    console.log('Composing email');
    composeEmail(parsedData);
    console.log('Done');
  } else {
    console.log("It's not Sunday or Thursday");
  }
}

main();
