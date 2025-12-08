const express = require('express');
const app = express();
const raceroutes = require('./src/routes/raceRoutes');
const testroutes = require('./src/routes/testRoutes');
const errorHandler = require('./src/middlewares/errorHandler');

app.use(express.json());

app.use('/api/races',raceroutes);
app.use('/api/test',testroutes);
app.use(errorHandler);


app.listen(5000,()=>{
    console.log('服务器启动在5000端口');
});

