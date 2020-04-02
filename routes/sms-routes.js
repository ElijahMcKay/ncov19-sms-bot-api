const axios = require('axios');
// enabling easy use of environment variables through a .env file
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
// using env variables for this shorthand verification
// const client = require("twilio")(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN); may not be necessary for the time being
const MessagingResponse = require('twilio').twiml.MessagingResponse;

// one liner to instantiate Express Router
const router = require('express').Router();

// const fetchCountyState = (postcode) => {
//   return axios
//     .get(`https://api.opencagedata.com/geocode/v1/google-v3-json?q=country=us|postcode=${postcode}&key=${process.env.GEOCODING_KEY}`)
//     .then(res => {
//       console.log(res.data)
//     })
// }
// ======== Routes =========

// -- POST Routes --
router.post('/', async (req, res) => {
  // destructuring user input from request body
  console.log('REQ.BODY', req.body);
  const postalcode = req.body.Body;
  // TODO: Make sure postal code is string, 5 digits, in US

  console.log(postalcode);
  // twilio webhooks expects their TwiMl XML format specified here: https://www.twilio.com/docs/glossary/what-is-twilio-markup-language-twiml
  // can also use raw XML in lieu of provided helper functions
  const twiml = new MessagingResponse();

  // checks if user inputted proper info
  try {
    // this already provides city/state, but current dashboard API is expecting county/state
    // const { latitude, longitude, state } = zipcodes.lookup(Body);

    // using this library to get county from coords
    // look into `node -–max-old-space-size=8192 your-file.js` or potentially running us-counties as its own process to help RAM performance
    // const { NAMELSAD10 } = findCounty([longitude, latitude]);
    let county = '';
    let state = '';
    await axios
      .get(
        `https://api.opencagedata.com/geocode/v1/google-v3-json?q=countrycode=us|postcode=${postalcode}&key=${process.env.GEOCODING_KEY}&limit=1`
      )
      .then(res => {
        // console.log(
        //   'ADDRESS COMPONENTS',
        //   res.data.results[0].address_components
        // );
        // console.log('GEOMETRY', res.data.results[0].geometry);
        if (res.data.results.length !== 0) {
          const formatedAddressArray = res.data.results[0].formatted_address.split(
            ','
          );
          console.log('FORMATED ADDRESS ARRAY', formatedAddressArray);
          state = formatedAddressArray[1].split(' ')[1];
          // const countyArray = formatedAddressArray[0].split(' ');
          county = formatedAddressArray[0]
            .split(' ')
            .pop()
            .join(' ');
        } else {
          console.log('else');
        }
      })
      .catch(err => {
        console.log(err);
      });

    // declaring options for POST request to main API
    const postOptions = {
      state: state,
      county: county
    };

    console.log(postOptions);

    let stateInfo = {};
    await axios
      .post('https://github.com/ncov19-us/back-end/county', postOptions)
      .then(res => {
        console.log('POST REQUEST', res.data);
        stateInfo = { ...res.data.message };
      });

    console.log(stateInfo);

    twiml.message(
      `
      Here are your local updates:
      ${postOptions.state}
      ${postOptions.county}
      Total tested: ${stateInfo.tested}
      Tested today: ${stateInfo.todays_tested}
      Total confirmed cases: ${stateInfo.confirmed}
      Confirmed cases today: ${stateInfo.todays_confirmed}
      Total deaths: ${stateInfo.deaths}
      Today's deaths: ${stateInfo.todays_deaths}

      For more indepth info: https://ncov19.us/
      `
    );
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
  } catch (err) {
    // setting inital message in case of failure, request header contents
    twiml.message(
      `
    Sorry, I didn't understand that message.  Make sure to respond with a 5 digit zip code.

    For more indepth info: https://ncov19.us/
    `
    );
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
  }
});

module.exports = router;
