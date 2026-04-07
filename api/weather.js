const https = require('https');

const fallbackWeather = {
  daily: {
    time: Array.from({length: 6}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    }),
    weathercode: [1, 2, 2, 3, 3, 2],
    temperature_2m_max: [28, 27, 26, 25, 24, 26],
    temperature_2m_min: [18, 17, 16, 15, 14, 16]
  }
};

export default (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const url = 'https://api.open-meteo.com/v1/forecast?latitude=31.7683&longitude=35.2137&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia/Jerusalem';

  https.get(url, (apiRes) => {
    let data = '';

    apiRes.on('data', chunk => {
      data += chunk;
    });

    apiRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        res.json(parsed);
      } catch(e) {
        console.warn('Weather parsing error, using fallback');
        res.json(fallbackWeather);
      }
    });
  }).on('error', (err) => {
    console.warn('Weather API error, using fallback');
    res.json(fallbackWeather);
  }).setTimeout(5000);
};
