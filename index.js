'use strict';
const axios = require('axios');
const moment = require('moment-timezone');
const private_key = require('./pkey.json');
const { google } = require('googleapis');

exports.http = async (request, response) => {
  // Get parameters from env.
  const zoom_oauth_a = process.env.ZOOM_OAUTH_A;
  const zoom_oauth_b = process.env.ZOOM_OAUTH_B;
  const google_calendar_id = process.env.GOOGLE_CALENDAR_ID;

  // body example.
  // body.title = 'drinking party';
  // body.start_time = '2023-10-14T22:00:00';
  // body.duration_min = 60;
  // body.host = '@keiji';
  let body = request.body;
  body.timezone = 'Asia/Tokyo';

  // Get access token before book meeting.
  let zoom_access_token = await get_access_token(zoom_oauth_a, zoom_oauth_b);

  // Book meeting.
  let zoom_data = make_zoom_data(body);
  let zoom_meeting_url = await book_meeting(zoom_data, zoom_access_token);

  // Create google calendar event.
  let additional_info = { "url": zoom_meeting_url };
  let google_calendar_event_data = make_google_calendar_event_data(body, additional_info);
  let google_calendar_event = await create_google_calendar_event(google_calendar_event_data, google_calendar_id);

  response.status(200).send(zoom_meeting_url);
};

async function get_access_token(zoom_oauth_a, zoom_oauth_b) {
  let zoom_auth_url = 'https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + zoom_oauth_a;
  let zoom_access_token = await axios.post(zoom_auth_url, {}, {
    headers: {
      "Authorization": 'Basic ' + zoom_oauth_b
    }
  });
  return zoom_access_token.data.access_token;
}

async function book_meeting(zoom_data, zoom_access_token) {
  let zoom_meeting_url = 'https://api.zoom.us/v2/users/me/meetings';
  let zoom_meeting = await axios.post(zoom_meeting_url, zoom_data, {
    headers: {
      "Authorization": 'Bearer ' + zoom_access_token
    }
  });
  return zoom_meeting.data.join_url;
}

async function create_google_calendar_event(google_calendar_event_data, google_calendar_id) {
  let calendar = google.calendar('v3');
  let scope = ['https://www.googleapis.com/auth/calendar'];
  let jwt_client = new google.auth.JWT(private_key.client_email, null, private_key.private_key, scope);
  jwt_client.authorize();
  let google_response = calendar.events.insert({ auth: jwt_client, calendarId: google_calendar_id, resource: google_calendar_event_data });
  return google_response;
}

function make_zoom_data(body) {
  let start_time = moment(body.start_time);
  let zoom_data = {
    "topic": body.title,
    "type": "2",
    "start_time": start_time.format("YYYY-MM-DDTHH:mm:ss"),
    "duration": body.duration_min,
    "timezone": body.timezone,
    "password": "nantsuku",
    "agenda": "Host is " + body.host,
    "settings": {
      "host_video": "true",
      "participant_video": "true",
      "cn_meeting": "false",
      "in_meeting": "false",
      "join_before_host": "true",
      "mute_upon_entry": "false",
      "waiting_room": "false",
      "watermark": "true",
      "use_pmi": "false",
      "approval_type": "2",
      "registration_type": "3",
      "registrants_confirmation_email": "false",
      "registrants_email_notification": "false",
      "audio": "both",
      "auto_recording": "none",
      "meeting_authentication": "false"
    }
  };
  return zoom_data;
}

function make_google_calendar_event_data(body, additional_info) {
  let start_time = moment(body.start_time);
  let end_time = moment(body.start_time).add(body.duration_min, 'minutes');
  let title = body.title + '(' + body.host + ')';
  let event = {
    'summary': title,
    'location': '',
    'description': additional_info.url,
    'start': {
      'dateTime': start_time.format("YYYY-MM-DDTHH:mm:ss"),
      'timeZone': body.timezone
    },
    'end': {
      'dateTime': end_time.format("YYYY-MM-DDTHH:mm:ss"),
      'timeZone': body.timezone
    },
    'reminders': {
      'useDefault': false,
      'overrides': [
        { 'method': 'popup', 'minutes': 60 }
      ]
    }
  };
  return event;
}