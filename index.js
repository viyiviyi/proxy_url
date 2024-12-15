const http = require("http");
const https = require("https");

http.createServer(function (req, res) {
    console.log("proxy: ", req.url.replace(/^\//, ""));
    try {
        new URL(req.url.replace(/^\//, ""));
    } catch (error) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not found");
        return;
    }
    let requestUrl = new URL(req.url.replace(/^\//, ""));
    if (requestUrl.pathname === "/") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not found");
        return;
    }

    let lastHost = requestUrl.origin;
    requestUrl = new URL(requestUrl.href.substring(requestUrl.href.indexOf("http", 4)));

    let newRequestOptions = {
        hostname: requestUrl.hostname,
        port: requestUrl.port || (requestUrl.protocol === "https:" ? 443 : 80),
        path: requestUrl.pathname + requestUrl.search,
        method: req.method,
        headers: req.headers,
    };

    newRequestOptions.headers.host = requestUrl.host;
    newRequestOptions.headers.origin = requestUrl.origin;
    newRequestOptions.headers.referer = "";
    newRequestOptions.headers["user-agent"] = "";
    for (let key in newRequestOptions.headers) {
        newRequestOptions.headers[key] = newRequestOptions.headers[key].replace(lastHost + "/", "");
    }
    const corsHeaderKeyReg =
        /access-control-allow-origin|Access-Control-Allow-Methods|Access-Control-Allow-Headers|Access-Control-Allow-credentials/i;
    const CORS_HEAD = {};
    CORS_HEAD["Access-Control-Allow-Origin"] = "*";
    CORS_HEAD["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    CORS_HEAD["Access-Control-Allow-Headers"] = "Content-Type, Content-Length, Authorization, Accept, X-Requested-With";
    CORS_HEAD["Access-Control-Allow-credentials"] = "true";
    let modifiedRequest;
    if (requestUrl.protocol === "https:") {
        modifiedRequest = https.request(newRequestOptions, function (response) {
            let modifiedResponse = response;
            console.log(modifiedResponse.headers);
            delete modifiedResponse.headers["content-security-policy"];
            delete modifiedResponse.headers["content-security-policy-report-only"];
            delete modifiedResponse.headers["clear-site-data"];
            Object.keys(modifiedResponse.headers).forEach((key) => {
                if (corsHeaderKeyReg.test(key)) {
                    delete modifiedResponse.headers[key];
                }
            });
            res.writeHead(response.statusCode, { ...modifiedResponse.headers, ...CORS_HEAD });
            response.pipe(res);
        });
    } else {
        modifiedRequest = http.request(newRequestOptions, function (response) {
            let modifiedResponse = response;
            delete modifiedResponse.headers["content-security-policy"];
            delete modifiedResponse.headers["content-security-policy-report-only"];
            delete modifiedResponse.headers["clear-site-data"];
            Object.keys(modifiedResponse.headers).forEach((key) => {
                if (corsHeaderKeyReg.test(key)) {
                    delete modifiedResponse.headers[key];
                }
            });
            res.writeHead(response.statusCode, { ...modifiedResponse.headers, ...CORS_HEAD });
            response.pipe(res);
        });
    }
    modifiedRequest.on("error", function (e) {
        console.error(e);
        res.writeHead(500, { "Content-Type": "text/plain", ...CORS_HEAD });
        res.end("Internal Server Error");
    });
    if (req.method === "OPTIONS") {
        res.writeHead(200, { "Content-Type": "text/plain", ...CORS_HEAD });
        res.end();
    } else {
        req.pipe(modifiedRequest);
    }
}).listen(3000);
