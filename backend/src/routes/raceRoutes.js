const express = require('express');
const routers = express.Router();

// routers.get('/',(req,res)=>{
//     const races = [
//         { id: 1 ,name : '第一届盯帧杯', date:'2025-11-15'},
//         { id: 2 ,name : '第二届盯帧杯', date:'2025-12-25'},
//     ];

//     res.json(races);
// });


// routers.post('/',(req,res)=>{
//     const {name ,date} = req.body;
//     console.log(req.body);
//     const newRace ={
//         id: Date.now(),
//         name,
//         date
//     };
//     res.status(201).json({
//         message:'创建成功',
//         data:newRace
//     });
// });

routers.get('/',require('../controllers/raceController').getRaces);
routers.get('/:id',require('../controllers/raceController').getRaceById);
routers.post('/',require('../controllers/raceController').createRace);
routers.delete('/:id',require('../controllers/raceController').deleteRace);
routers.put('/:id',require('../controllers/raceController').updateRace);

module.exports = routers;