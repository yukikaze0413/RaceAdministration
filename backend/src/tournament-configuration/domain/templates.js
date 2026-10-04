'use strict';
const {randomUUID}=require('node:crypto');
const {object,text,ConfigurationError}=require('./structure');
const templates={
  "four-groups": {
    "entrantKind": "individual",
    "structureVersion": "structure-v1",
    "routingVersion": "routing-v1",
    "stages": [
      {
        "id": "A",
        "order": 1,
        "capacity": 8,
        "formatIntent": "single-elimination",
        "groups": [
          {
            "id": "a",
            "stageId": "A",
            "capacity": 2
          },
          {
            "id": "b",
            "stageId": "A",
            "capacity": 2
          },
          {
            "id": "c",
            "stageId": "A",
            "capacity": 2
          },
          {
            "id": "d",
            "stageId": "A",
            "capacity": 2
          }
        ]
      },
      {
        "id": "B",
        "order": 2,
        "capacity": 2,
        "formatIntent": "fixed-swiss",
        "groups": [
          {
            "id": "X",
            "stageId": "B",
            "capacity": 2
          }
        ]
      },
      {
        "id": "C",
        "order": 3,
        "capacity": 8,
        "formatIntent": "single-elimination",
        "groups": []
      }
    ],
    "pools": [],
    "routes": [
      {
        "id": "ra",
        "source": {
          "stageId": "A",
          "groupId": "a"
        },
        "selector": {
          "kind": "rankRange",
          "from": 1,
          "to": 1
        },
        "quota": 1,
        "sort": [
          {
            "field": "initialSeed",
            "direction": "asc"
          }
        ],
        "target": {
          "stageId": "B",
          "groupId": "X"
        },
        "placement": {
          "kind": "seed",
          "positions": [
            1
          ]
        }
      },
      {
        "id": "rb",
        "source": {
          "stageId": "A",
          "groupId": "b"
        },
        "selector": {
          "kind": "rankRange",
          "from": 1,
          "to": 1
        },
        "quota": 1,
        "sort": [
          {
            "field": "initialSeed",
            "direction": "asc"
          }
        ],
        "target": {
          "stageId": "B",
          "groupId": "X"
        },
        "placement": {
          "kind": "seed",
          "positions": [
            2
          ]
        }
      },
      {
        "id": "rc",
        "source": {
          "stageId": "A",
          "groupId": "c"
        },
        "selector": {
          "kind": "rankRange",
          "from": 1,
          "to": 1
        },
        "quota": 1,
        "sort": [
          {
            "field": "initialSeed",
            "direction": "asc"
          }
        ],
        "target": {
          "stageId": "C"
        },
        "placement": {
          "kind": "slot",
          "positions": [
            1
          ]
        }
      },
      {
        "id": "rd",
        "source": {
          "stageId": "A",
          "groupId": "d"
        },
        "selector": {
          "kind": "rankRange",
          "from": 1,
          "to": 1
        },
        "quota": 1,
        "sort": [
          {
            "field": "initialSeed",
            "direction": "asc"
          }
        ],
        "target": {
          "stageId": "C"
        },
        "placement": {
          "kind": "slot",
          "positions": [
            8
          ]
        }
      }
    ]
  },
  "pool": {
    "entrantKind": "individual",
    "structureVersion": "structure-v1",
    "routingVersion": "routing-v1",
    "stages": [
      {
        "id": "A",
        "order": 1,
        "capacity": 4,
        "formatIntent": "fixed-swiss",
        "groups": []
      },
      {
        "id": "B",
        "order": 2,
        "capacity": 4,
        "formatIntent": "round-robin",
        "groups": []
      },
      {
        "id": "C",
        "order": 3,
        "capacity": 8,
        "formatIntent": "single-elimination",
        "groups": []
      }
    ],
    "pools": [
      {
        "id": "P",
        "capacity": 2,
        "sort": [
          {
            "field": "sourcePriority",
            "direction": "asc",
            "sources": [
              "A",
              "B"
            ]
          },
          {
            "field": "initialSeed",
            "direction": "asc"
          }
        ]
      }
    ],
    "routes": [
      {
        "id": "fromA",
        "source": {
          "stageId": "A"
        },
        "selector": {
          "kind": "rankRange",
          "from": 1,
          "to": 1
        },
        "quota": 1,
        "sort": [
          {
            "field": "initialSeed",
            "direction": "asc"
          }
        ],
        "target": {
          "poolId": "P"
        }
      },
      {
        "id": "fromB",
        "source": {
          "stageId": "B"
        },
        "selector": {
          "kind": "rankRange",
          "from": 1,
          "to": 1
        },
        "quota": 1,
        "sort": [
          {
            "field": "initialSeed",
            "direction": "asc"
          }
        ],
        "target": {
          "poolId": "P"
        }
      },
      {
        "id": "out",
        "source": {
          "poolId": "P"
        },
        "selector": {
          "kind": "all"
        },
        "quota": 2,
        "sort": [
          {
            "field": "poolSeed",
            "direction": "asc"
          }
        ],
        "target": {
          "stageId": "C"
        },
        "placement": {
          "kind": "slot",
          "positions": [
            1,
            8
          ]
        }
      }
    ]
  }
};
function instantiate(payload,tournamentId) {
 object(payload,['templateId','templateVersion'],'/template');text(payload.templateId,'/template/templateId');text(payload.templateVersion,'/template/templateVersion');
 if(payload.templateVersion!=='1'||!Object.hasOwn(templates,payload.templateId))throw new ConfigurationError('INVALID_INPUT','模板版本不存在');
 const c=structuredClone(templates[payload.templateId]),ids=new Map();
 const objects=[...c.stages,...c.stages.flatMap(s=>s.groups),...c.pools,...c.routes];
 objects.forEach(o=>ids.set(o.id,randomUUID()));
 const rewrite=ref=>{for(const k of ['stageId','groupId','poolId'])if(ref[k])ref[k]=ids.get(ref[k]);};
 for(const s of c.stages)for(const g of s.groups)g.stageId=ids.get(g.stageId);
 for(const r of c.routes){rewrite(r.source);rewrite(r.target);}
 for(const sort of [...c.pools.map(p=>p.sort),...c.routes.map(r=>r.sort)])for(const s of sort)if(s.sources)s.sources=s.sources.map(id=>ids.get(id));
 for(const o of objects){o.id=ids.get(o.id);if(o.tournamentId)o.tournamentId=tournamentId;}
 c.templateOrigin={id:payload.templateId,version:payload.templateVersion};return c;
}
function listTemplates(){return Object.entries(templates).map(([id,structure])=>({id,version:'1',description:id==='four-groups'?'四组分流结构':'选手池汇合结构',structure:structuredClone(structure)}));}
module.exports={instantiate,listTemplates};
