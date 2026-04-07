const https = require('https');

export default (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const now = new Date();
    const url = `https://www.hebcal.com/converter?cfg=json&gy=${now.getFullYear()}&gm=${now.getMonth()+1}&gd=${now.getDate()}&g2h=1`;

    const req2 = https.get(url, (apiRes) => {
      if (apiRes.statusCode !== 200) {
        return res.json({ hebrew: '' });
      }
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          res.json(parsed);
        } catch(e) {
          res.json({ hebrew: '' });
        }
      });
    }).on('error', () => {
      res.json({ hebrew: '' });
    });

    req2.setTimeout(5000);
  } catch(e) {
    res.json({ hebrew: '' });
  }
};
