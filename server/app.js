const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const stream = require('stream');
const app = express();

const fieldsMap = {
    'TWEET': 'tweet',
    'USER': 'user',
    'LANG': 'lang'
};

const request = require('request');

const rootApp = path.normalize(__dirname + '../', '../');

const serverPath = path.normalize(__dirname, '/..');
const rootPath = path.normalize(path.join(serverPath + '/..'), '/..');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false}));

app.use(express.static(path.join(rootPath, 'src')));

app.get('/languages', (req, res) => {
    return http.get('http://tweet-service.herokuapp.com/languages', (resp) => {
         resp.on('data', (data) => {
             console.log('SUCCESS');
             res.write(data);
         });
        resp.on('error', (data) => {
            console.log('Server Error');
            res.status(500).send({reason: 'Server Error'});
        });

        resp.on('end', (data) => {
            console.log('End Response');
             res.status(200).send(data);
        });

        resp.on('close', function (err) {
            console.log('Stream has been destroyed and closed');
            res.status(400).send({reason: 'Stream destroyed'});
        });
    });
})

app.get('/queryTweets', (req, res) => {
    let queryFilters = req.query.queryOptions;
    queryFilters = JSON.parse(queryFilters);

    let count = 0;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    return http.get('http://tweet-service.herokuapp.com/stream', (resp) => {
        resp.on('data', (data) => {
            if (applyFilter(data, queryFilters)) {
                count++;
                res.write(data);

                // only send 500 success results until implement lazy loading of stream on client
                if (count > 500) {
                    resp.pause();
                }
            }
        });
        resp.on('error', (data) => {
            res.writeHead(500);
            res.end('Something bad happened');
        });

        resp.on('end', (data) => {
            res.writeHead(200);
            res.end('DONE');
        });

        resp.on('close', function (err) {
         console.log('Stream has been destroyed and closed');
        });
    })
   
});

function applyFilter(data, queryFilters) {
    let formattedOutput = data.toString().replace('data: ', '');
    formattedOutput = tryParsing(formattedOutput);

    let validData = true;
    queryFilters.forEach(query => {
        if (!processQuery(formattedOutput, query)) {
            validData = false;
        }
    });
    if (validData) {
        return true;
    } else {
        return false;
    }
}

function processQuery(data, query) {
    if (query.Operator === 'CONTAINS') {
        return data[fieldsMap[query.Field]] && data[fieldsMap[query.Field]].includes(query.Value);
    } else if (query.Operator === 'REGEX') {
        return data[fieldsMap[query.Field]] && data[fieldsMap[query.Field]].match(RegExp(query.Value));
    } else if (query.Operator === 'EQUALS') {
        return data[fieldsMap[query.Field]] === query.Value;
    } else {
        return true;
    }
}

function tryParsing(data) {
    try {
        return JSON.parse(data);
    } catch (e) {
        // log error
        console.log('FAILED Parsing');
        return {tweet: ''};
    }
}

// home page
app.route('/*', (req, res) => {
    res.sendFile(path.resolve(rootPath, 'src/index.html'));
});

const port = process.env.PORT || '5000';
app.set('port', port);

const server = http.createServer(app);

server.listen(port, () => console.log(`Running on localhost:${port}`));