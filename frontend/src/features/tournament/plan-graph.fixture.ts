// Captured server DTOs, not generated layout expectations.
export const fixtures: Record<string, any> = {
  "[\"single-cut-v2\",8,1,{}]": {
    "structure": {
      "entrantKind": "individual",
      "structureVersion": "structure-v2",
      "routingVersion": "routing-v2",
      "stages": [
        {
          "id": "s",
          "name": "阶段",
          "order": 1,
          "format": "single-elimination",
          "ruleVersion": "single-cut-v2",
          "groupSize": 8,
          "groupCount": 1,
          "qualifyCount": 1,
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "bracketMode": "complete",
            "thirdPlace": false
          },
          "groups": [
            {
              "id": "g",
              "stageId": "s",
              "capacity": 8
            }
          ],
          "capacity": 8
        }
      ],
      "pools": [],
      "routes": []
    },
    "plan": {
      "version": "compiled-plan-v2",
      "configurationId": "c",
      "units": [
        {
          "unitKey": "plan-v2/c/g/unit/0/0",
          "stageId": "s",
          "groupId": "g",
          "format": "single-elimination",
          "ruleVersion": "single-cut-v2",
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "bracketMode": "complete",
            "thirdPlace": false
          },
          "inputs": [
            {
              "channel": "seed",
              "capacity": 8,
              "positionKind": "seed",
              "initialLosses": 0,
              "placementPorts": [
                "seed",
                "slot"
              ]
            }
          ],
          "outputs": {
            "qualification": [
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 1,
                "source": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/final/3/1"
                }
              }
            ],
            "rank": [
              {
                "kind": "winner",
                "matchKey": "plan-v2/c/g/final/3/1"
              },
              {
                "kind": "loser",
                "matchKey": "plan-v2/c/g/final/3/1"
              }
            ],
            "tiedRanks": [
              {
                "rank": 3,
                "sources": [
                  {
                    "kind": "loser",
                    "matchKey": "plan-v2/c/g/elimination/2/1"
                  },
                  {
                    "kind": "loser",
                    "matchKey": "plan-v2/c/g/elimination/2/2"
                  }
                ]
              }
            ]
          },
          "matches": [
            {
              "planKey": "plan-v2/c/g/elimination/1/1",
              "role": "elimination",
              "round": 1,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 8,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/2",
              "role": "elimination",
              "round": 1,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 5,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/3",
              "role": "elimination",
              "round": 1,
              "index": 3,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 7,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/4",
              "role": "elimination",
              "round": 1,
              "index": 4,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 6,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/1",
              "role": "elimination",
              "round": 2,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/1",
                "plan-v2/c/g/elimination/1/2"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/2",
              "role": "elimination",
              "round": 2,
              "index": 2,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/3"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/4"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/3",
                "plan-v2/c/g/elimination/1/4"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/final/3/1",
              "role": "final",
              "round": 3,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/2/1",
                "plan-v2/c/g/elimination/2/2"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            }
          ],
          "windows": [],
          "waves": [
            {
              "planKey": "plan-v2/c/g/wave/1/0",
              "number": 1,
              "previousWaveKey": null,
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/elimination/1/1",
                "plan-v2/c/g/elimination/1/2",
                "plan-v2/c/g/elimination/1/3",
                "plan-v2/c/g/elimination/1/4"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/2/0",
              "number": 2,
              "previousWaveKey": "plan-v2/c/g/wave/1/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/elimination/2/1",
                "plan-v2/c/g/elimination/2/2"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/3/0",
              "number": 3,
              "previousWaveKey": "plan-v2/c/g/wave/2/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/final/3/1"
              ]
            }
          ],
          "confirmationProfile": "group-round-v1"
        }
      ],
      "connections": []
    }
  },
  "[\"single-cut-v2\",64,1,{}]": {
    "structure": {
      "entrantKind": "individual",
      "structureVersion": "structure-v2",
      "routingVersion": "routing-v2",
      "stages": [
        {
          "id": "s",
          "name": "阶段",
          "order": 1,
          "format": "single-elimination",
          "ruleVersion": "single-cut-v2",
          "groupSize": 64,
          "groupCount": 1,
          "qualifyCount": 1,
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "bracketMode": "complete",
            "thirdPlace": false
          },
          "groups": [
            {
              "id": "g",
              "stageId": "s",
              "capacity": 64
            }
          ],
          "capacity": 64
        }
      ],
      "pools": [],
      "routes": []
    },
    "plan": {
      "version": "compiled-plan-v2",
      "configurationId": "c",
      "units": [
        {
          "unitKey": "plan-v2/c/g/unit/0/0",
          "stageId": "s",
          "groupId": "g",
          "format": "single-elimination",
          "ruleVersion": "single-cut-v2",
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "bracketMode": "complete",
            "thirdPlace": false
          },
          "inputs": [
            {
              "channel": "seed",
              "capacity": 64,
              "positionKind": "seed",
              "initialLosses": 0,
              "placementPorts": [
                "seed",
                "slot"
              ]
            }
          ],
          "outputs": {
            "qualification": [
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 1,
                "source": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/final/6/1"
                }
              }
            ],
            "rank": [
              {
                "kind": "winner",
                "matchKey": "plan-v2/c/g/final/6/1"
              },
              {
                "kind": "loser",
                "matchKey": "plan-v2/c/g/final/6/1"
              }
            ],
            "tiedRanks": [
              {
                "rank": 3,
                "sources": [
                  {
                    "kind": "loser",
                    "matchKey": "plan-v2/c/g/elimination/5/1"
                  },
                  {
                    "kind": "loser",
                    "matchKey": "plan-v2/c/g/elimination/5/2"
                  }
                ]
              }
            ]
          },
          "matches": [
            {
              "planKey": "plan-v2/c/g/elimination/1/1",
              "role": "elimination",
              "round": 1,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 64,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/2",
              "role": "elimination",
              "round": 1,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 32,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 33,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/3",
              "role": "elimination",
              "round": 1,
              "index": 3,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 16,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 49,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/4",
              "role": "elimination",
              "round": 1,
              "index": 4,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 17,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 48,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/5",
              "role": "elimination",
              "round": 1,
              "index": 5,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 8,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 57,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/6",
              "role": "elimination",
              "round": 1,
              "index": 6,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 25,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 40,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/7",
              "role": "elimination",
              "round": 1,
              "index": 7,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 9,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 56,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/8",
              "role": "elimination",
              "round": 1,
              "index": 8,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 24,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 41,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/9",
              "role": "elimination",
              "round": 1,
              "index": 9,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 61,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/10",
              "role": "elimination",
              "round": 1,
              "index": 10,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 29,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 36,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/11",
              "role": "elimination",
              "round": 1,
              "index": 11,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 13,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 52,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/12",
              "role": "elimination",
              "round": 1,
              "index": 12,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 20,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 45,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/13",
              "role": "elimination",
              "round": 1,
              "index": 13,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 5,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 60,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/14",
              "role": "elimination",
              "round": 1,
              "index": 14,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 28,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 37,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/15",
              "role": "elimination",
              "round": 1,
              "index": 15,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 12,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 53,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/16",
              "role": "elimination",
              "round": 1,
              "index": 16,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 21,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 44,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/17",
              "role": "elimination",
              "round": 1,
              "index": 17,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 63,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/18",
              "role": "elimination",
              "round": 1,
              "index": 18,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 31,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 34,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/19",
              "role": "elimination",
              "round": 1,
              "index": 19,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 15,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 50,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/20",
              "role": "elimination",
              "round": 1,
              "index": 20,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 18,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 47,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/21",
              "role": "elimination",
              "round": 1,
              "index": 21,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 7,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 58,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/22",
              "role": "elimination",
              "round": 1,
              "index": 22,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 26,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 39,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/23",
              "role": "elimination",
              "round": 1,
              "index": 23,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 10,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 55,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/24",
              "role": "elimination",
              "round": 1,
              "index": 24,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 23,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 42,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/25",
              "role": "elimination",
              "round": 1,
              "index": 25,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 62,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/26",
              "role": "elimination",
              "round": 1,
              "index": 26,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 30,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 35,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/27",
              "role": "elimination",
              "round": 1,
              "index": 27,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 14,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 51,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/28",
              "role": "elimination",
              "round": 1,
              "index": 28,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 19,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 46,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/29",
              "role": "elimination",
              "round": 1,
              "index": 29,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 6,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 59,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/30",
              "role": "elimination",
              "round": 1,
              "index": 30,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 27,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 38,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/31",
              "role": "elimination",
              "round": 1,
              "index": 31,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 11,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 54,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/32",
              "role": "elimination",
              "round": 1,
              "index": 32,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 22,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 43,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/1",
              "role": "elimination",
              "round": 2,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/1",
                "plan-v2/c/g/elimination/1/2"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/2",
              "role": "elimination",
              "round": 2,
              "index": 2,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/3"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/4"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/3",
                "plan-v2/c/g/elimination/1/4"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/3",
              "role": "elimination",
              "round": 2,
              "index": 3,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/5"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/6"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/5",
                "plan-v2/c/g/elimination/1/6"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/4",
              "role": "elimination",
              "round": 2,
              "index": 4,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/7"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/8"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/7",
                "plan-v2/c/g/elimination/1/8"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/5",
              "role": "elimination",
              "round": 2,
              "index": 5,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/9"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/10"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/9",
                "plan-v2/c/g/elimination/1/10"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/6",
              "role": "elimination",
              "round": 2,
              "index": 6,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/11"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/12"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/11",
                "plan-v2/c/g/elimination/1/12"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/7",
              "role": "elimination",
              "round": 2,
              "index": 7,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/13"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/14"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/13",
                "plan-v2/c/g/elimination/1/14"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/8",
              "role": "elimination",
              "round": 2,
              "index": 8,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/15"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/16"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/15",
                "plan-v2/c/g/elimination/1/16"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/9",
              "role": "elimination",
              "round": 2,
              "index": 9,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/17"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/18"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/17",
                "plan-v2/c/g/elimination/1/18"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/10",
              "role": "elimination",
              "round": 2,
              "index": 10,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/19"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/20"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/19",
                "plan-v2/c/g/elimination/1/20"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/11",
              "role": "elimination",
              "round": 2,
              "index": 11,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/21"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/22"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/21",
                "plan-v2/c/g/elimination/1/22"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/12",
              "role": "elimination",
              "round": 2,
              "index": 12,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/23"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/24"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/23",
                "plan-v2/c/g/elimination/1/24"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/13",
              "role": "elimination",
              "round": 2,
              "index": 13,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/25"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/26"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/25",
                "plan-v2/c/g/elimination/1/26"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/14",
              "role": "elimination",
              "round": 2,
              "index": 14,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/27"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/28"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/27",
                "plan-v2/c/g/elimination/1/28"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/15",
              "role": "elimination",
              "round": 2,
              "index": 15,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/29"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/30"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/29",
                "plan-v2/c/g/elimination/1/30"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/16",
              "role": "elimination",
              "round": 2,
              "index": 16,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/31"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/32"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/31",
                "plan-v2/c/g/elimination/1/32"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/3/1",
              "role": "elimination",
              "round": 3,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/2/1",
                "plan-v2/c/g/elimination/2/2"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/3/2",
              "role": "elimination",
              "round": 3,
              "index": 2,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/3"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/4"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/2/3",
                "plan-v2/c/g/elimination/2/4"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/3/3",
              "role": "elimination",
              "round": 3,
              "index": 3,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/5"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/6"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/2/5",
                "plan-v2/c/g/elimination/2/6"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/3/4",
              "role": "elimination",
              "round": 3,
              "index": 4,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/7"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/8"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/2/7",
                "plan-v2/c/g/elimination/2/8"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/3/5",
              "role": "elimination",
              "round": 3,
              "index": 5,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/9"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/10"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/2/9",
                "plan-v2/c/g/elimination/2/10"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/3/6",
              "role": "elimination",
              "round": 3,
              "index": 6,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/11"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/12"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/2/11",
                "plan-v2/c/g/elimination/2/12"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/3/7",
              "role": "elimination",
              "round": 3,
              "index": 7,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/13"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/14"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/2/13",
                "plan-v2/c/g/elimination/2/14"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/3/8",
              "role": "elimination",
              "round": 3,
              "index": 8,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/15"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/16"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/2/15",
                "plan-v2/c/g/elimination/2/16"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/4/1",
              "role": "elimination",
              "round": 4,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/3/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/3/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/3/1",
                "plan-v2/c/g/elimination/3/2"
              ],
              "wave": 4,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/4/2",
              "role": "elimination",
              "round": 4,
              "index": 2,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/3/3"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/3/4"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/3/3",
                "plan-v2/c/g/elimination/3/4"
              ],
              "wave": 4,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/4/3",
              "role": "elimination",
              "round": 4,
              "index": 3,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/3/5"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/3/6"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/3/5",
                "plan-v2/c/g/elimination/3/6"
              ],
              "wave": 4,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/4/4",
              "role": "elimination",
              "round": 4,
              "index": 4,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/3/7"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/3/8"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/3/7",
                "plan-v2/c/g/elimination/3/8"
              ],
              "wave": 4,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/5/1",
              "role": "elimination",
              "round": 5,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/4/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/4/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/4/1",
                "plan-v2/c/g/elimination/4/2"
              ],
              "wave": 5,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/5/2",
              "role": "elimination",
              "round": 5,
              "index": 2,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/4/3"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/4/4"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/4/3",
                "plan-v2/c/g/elimination/4/4"
              ],
              "wave": 5,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/final/6/1",
              "role": "final",
              "round": 6,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/5/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/5/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/5/1",
                "plan-v2/c/g/elimination/5/2"
              ],
              "wave": 6,
              "bestOf": 3,
              "condition": null
            }
          ],
          "windows": [],
          "waves": [
            {
              "planKey": "plan-v2/c/g/wave/1/0",
              "number": 1,
              "previousWaveKey": null,
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/elimination/1/1",
                "plan-v2/c/g/elimination/1/2",
                "plan-v2/c/g/elimination/1/3",
                "plan-v2/c/g/elimination/1/4",
                "plan-v2/c/g/elimination/1/5",
                "plan-v2/c/g/elimination/1/6",
                "plan-v2/c/g/elimination/1/7",
                "plan-v2/c/g/elimination/1/8",
                "plan-v2/c/g/elimination/1/9",
                "plan-v2/c/g/elimination/1/10",
                "plan-v2/c/g/elimination/1/11",
                "plan-v2/c/g/elimination/1/12",
                "plan-v2/c/g/elimination/1/13",
                "plan-v2/c/g/elimination/1/14",
                "plan-v2/c/g/elimination/1/15",
                "plan-v2/c/g/elimination/1/16",
                "plan-v2/c/g/elimination/1/17",
                "plan-v2/c/g/elimination/1/18",
                "plan-v2/c/g/elimination/1/19",
                "plan-v2/c/g/elimination/1/20",
                "plan-v2/c/g/elimination/1/21",
                "plan-v2/c/g/elimination/1/22",
                "plan-v2/c/g/elimination/1/23",
                "plan-v2/c/g/elimination/1/24",
                "plan-v2/c/g/elimination/1/25",
                "plan-v2/c/g/elimination/1/26",
                "plan-v2/c/g/elimination/1/27",
                "plan-v2/c/g/elimination/1/28",
                "plan-v2/c/g/elimination/1/29",
                "plan-v2/c/g/elimination/1/30",
                "plan-v2/c/g/elimination/1/31",
                "plan-v2/c/g/elimination/1/32"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/2/0",
              "number": 2,
              "previousWaveKey": "plan-v2/c/g/wave/1/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/elimination/2/1",
                "plan-v2/c/g/elimination/2/2",
                "plan-v2/c/g/elimination/2/3",
                "plan-v2/c/g/elimination/2/4",
                "plan-v2/c/g/elimination/2/5",
                "plan-v2/c/g/elimination/2/6",
                "plan-v2/c/g/elimination/2/7",
                "plan-v2/c/g/elimination/2/8",
                "plan-v2/c/g/elimination/2/9",
                "plan-v2/c/g/elimination/2/10",
                "plan-v2/c/g/elimination/2/11",
                "plan-v2/c/g/elimination/2/12",
                "plan-v2/c/g/elimination/2/13",
                "plan-v2/c/g/elimination/2/14",
                "plan-v2/c/g/elimination/2/15",
                "plan-v2/c/g/elimination/2/16"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/3/0",
              "number": 3,
              "previousWaveKey": "plan-v2/c/g/wave/2/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/elimination/3/1",
                "plan-v2/c/g/elimination/3/2",
                "plan-v2/c/g/elimination/3/3",
                "plan-v2/c/g/elimination/3/4",
                "plan-v2/c/g/elimination/3/5",
                "plan-v2/c/g/elimination/3/6",
                "plan-v2/c/g/elimination/3/7",
                "plan-v2/c/g/elimination/3/8"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/4/0",
              "number": 4,
              "previousWaveKey": "plan-v2/c/g/wave/3/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/elimination/4/1",
                "plan-v2/c/g/elimination/4/2",
                "plan-v2/c/g/elimination/4/3",
                "plan-v2/c/g/elimination/4/4"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/5/0",
              "number": 5,
              "previousWaveKey": "plan-v2/c/g/wave/4/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/elimination/5/1",
                "plan-v2/c/g/elimination/5/2"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/6/0",
              "number": 6,
              "previousWaveKey": "plan-v2/c/g/wave/5/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/final/6/1"
              ]
            }
          ],
          "confirmationProfile": "group-round-v1"
        }
      ],
      "connections": []
    }
  },
  "[\"single-cut-v2\",12,3,{\"bracketMode\":\"segmented\"}]": {
    "structure": {
      "entrantKind": "individual",
      "structureVersion": "structure-v2",
      "routingVersion": "routing-v2",
      "stages": [
        {
          "id": "s",
          "name": "阶段",
          "order": 1,
          "format": "single-elimination",
          "ruleVersion": "single-cut-v2",
          "groupSize": 12,
          "groupCount": 1,
          "qualifyCount": 3,
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "bracketMode": "segmented",
            "thirdPlace": false
          },
          "groups": [
            {
              "id": "g",
              "stageId": "s",
              "capacity": 12
            }
          ],
          "capacity": 12
        }
      ],
      "pools": [],
      "routes": []
    },
    "plan": {
      "version": "compiled-plan-v2",
      "configurationId": "c",
      "units": [
        {
          "unitKey": "plan-v2/c/g/unit/0/0",
          "stageId": "s",
          "groupId": "g",
          "format": "single-elimination",
          "ruleVersion": "single-cut-v2",
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "bracketMode": "segmented",
            "thirdPlace": false
          },
          "inputs": [
            {
              "channel": "seed",
              "capacity": 12,
              "positionKind": "seed",
              "initialLosses": 0,
              "placementPorts": [
                "seed",
                "slot"
              ]
            }
          ],
          "outputs": {
            "qualification": [
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 1,
                "source": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/1"
                }
              },
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 2,
                "source": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/2"
                }
              },
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 3,
                "source": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/3"
                }
              }
            ],
            "rank": []
          },
          "matches": [
            {
              "planKey": "plan-v2/c/g/elimination/1/1",
              "role": "elimination",
              "round": 1,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/2",
              "role": "elimination",
              "round": 1,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/3",
              "role": "elimination",
              "round": 1,
              "index": 3,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 5,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 8,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/4",
              "role": "elimination",
              "round": 1,
              "index": 4,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 6,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 7,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/5",
              "role": "elimination",
              "round": 1,
              "index": 5,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 9,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 12,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/6",
              "role": "elimination",
              "round": 1,
              "index": 6,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 10,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 11,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/1",
              "role": "elimination",
              "round": 2,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/1",
                "plan-v2/c/g/elimination/1/2"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/2",
              "role": "elimination",
              "round": 2,
              "index": 2,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/3"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/4"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/3",
                "plan-v2/c/g/elimination/1/4"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/3",
              "role": "elimination",
              "round": 2,
              "index": 3,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/5"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/6"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/elimination/1/5",
                "plan-v2/c/g/elimination/1/6"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            }
          ],
          "windows": [],
          "waves": [
            {
              "planKey": "plan-v2/c/g/wave/1/0",
              "number": 1,
              "previousWaveKey": null,
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/elimination/1/1",
                "plan-v2/c/g/elimination/1/2",
                "plan-v2/c/g/elimination/1/3",
                "plan-v2/c/g/elimination/1/4",
                "plan-v2/c/g/elimination/1/5",
                "plan-v2/c/g/elimination/1/6"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/2/0",
              "number": 2,
              "previousWaveKey": "plan-v2/c/g/wave/1/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/elimination/2/1",
                "plan-v2/c/g/elimination/2/2",
                "plan-v2/c/g/elimination/2/3"
              ]
            }
          ],
          "confirmationProfile": "group-round-v1"
        }
      ],
      "connections": []
    }
  },
  "[\"gsl-classic-v1\",4,2,{}]": {
    "structure": {
      "entrantKind": "individual",
      "structureVersion": "structure-v2",
      "routingVersion": "routing-v2",
      "stages": [
        {
          "id": "s",
          "name": "阶段",
          "order": 1,
          "format": "gsl",
          "ruleVersion": "gsl-classic-v1",
          "groupSize": 4,
          "groupCount": 1,
          "qualifyCount": 2,
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {}
          },
          "groups": [
            {
              "id": "g",
              "stageId": "s",
              "capacity": 4
            }
          ],
          "capacity": 4
        }
      ],
      "pools": [],
      "routes": []
    },
    "plan": {
      "version": "compiled-plan-v2",
      "configurationId": "c",
      "units": [
        {
          "unitKey": "plan-v2/c/g/unit/0/0",
          "stageId": "s",
          "groupId": "g",
          "format": "gsl",
          "ruleVersion": "gsl-classic-v1",
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {}
          },
          "inputs": [
            {
              "channel": "seed",
              "capacity": 4,
              "positionKind": "seed",
              "initialLosses": 0,
              "placementPorts": [
                "seed",
                "slot"
              ]
            }
          ],
          "outputs": {
            "qualification": [
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 1,
                "source": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/winners/2/1"
                }
              },
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 2,
                "source": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/decider/3/1"
                }
              }
            ],
            "rank": [
              {
                "kind": "winner",
                "matchKey": "plan-v2/c/g/winners/2/1"
              },
              {
                "kind": "winner",
                "matchKey": "plan-v2/c/g/decider/3/1"
              },
              {
                "kind": "loser",
                "matchKey": "plan-v2/c/g/decider/3/1"
              },
              {
                "kind": "loser",
                "matchKey": "plan-v2/c/g/elimination/2/1"
              }
            ]
          },
          "matches": [
            {
              "planKey": "plan-v2/c/g/opening/1/1",
              "role": "opening",
              "round": 1,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/opening/1/2",
              "role": "opening",
              "round": 1,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/winners/2/1",
              "role": "winners",
              "round": 2,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/opening/1/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/opening/1/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/opening/1/1",
                "plan-v2/c/g/opening/1/2"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/2/1",
              "role": "elimination",
              "round": 2,
              "index": 1,
              "sources": [
                {
                  "kind": "loser",
                  "matchKey": "plan-v2/c/g/opening/1/1"
                },
                {
                  "kind": "loser",
                  "matchKey": "plan-v2/c/g/opening/1/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/opening/1/1",
                "plan-v2/c/g/opening/1/2"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/decider/3/1",
              "role": "decider",
              "round": 3,
              "index": 1,
              "sources": [
                {
                  "kind": "loser",
                  "matchKey": "plan-v2/c/g/winners/2/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/2/1"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/winners/2/1",
                "plan-v2/c/g/elimination/2/1"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            }
          ],
          "windows": [],
          "waves": [
            {
              "planKey": "plan-v2/c/g/wave/1/0",
              "number": 1,
              "previousWaveKey": null,
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/opening/1/1",
                "plan-v2/c/g/opening/1/2"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/2/0",
              "number": 2,
              "previousWaveKey": "plan-v2/c/g/wave/1/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/winners/2/1",
                "plan-v2/c/g/elimination/2/1"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/3/0",
              "number": 3,
              "previousWaveKey": "plan-v2/c/g/wave/2/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/decider/3/1"
              ]
            }
          ],
          "confirmationProfile": "dependency-wave-v1"
        }
      ],
      "connections": []
    }
  },
  "[\"de-standard-v1\",8,1,{\"finalReset\":true}]": {
    "structure": {
      "entrantKind": "individual",
      "structureVersion": "structure-v2",
      "routingVersion": "routing-v2",
      "stages": [
        {
          "id": "s",
          "name": "阶段",
          "order": 1,
          "format": "double-elimination",
          "ruleVersion": "de-standard-v1",
          "groupSize": 8,
          "groupCount": 1,
          "qualifyCount": 1,
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "lowerEntryMode": "disabled",
            "finalReset": true
          },
          "groups": [
            {
              "id": "g",
              "stageId": "s",
              "capacity": 8
            }
          ],
          "capacity": 8
        }
      ],
      "pools": [],
      "routes": []
    },
    "plan": {
      "version": "compiled-plan-v2",
      "configurationId": "c",
      "units": [
        {
          "unitKey": "plan-v2/c/g/unit/0/0",
          "stageId": "s",
          "groupId": "g",
          "format": "double-elimination",
          "ruleVersion": "de-standard-v1",
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "lowerEntryMode": "disabled",
            "finalReset": true
          },
          "inputs": [
            {
              "channel": "upper",
              "capacity": 8,
              "positionKind": "seed",
              "initialLosses": 0,
              "placementPorts": [
                "seed",
                "slot"
              ]
            }
          ],
          "outputs": {
            "qualification": [
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 1,
                "source": {
                  "kind": "conditional",
                  "condition": {
                    "kind": "winner-side",
                    "matchKey": "plan-v2/c/g/final/1/1",
                    "side": 1
                  },
                  "whenTrue": {
                    "kind": "winner",
                    "matchKey": "plan-v2/c/g/final/2/1"
                  },
                  "whenFalse": {
                    "kind": "winner",
                    "matchKey": "plan-v2/c/g/final/1/1"
                  }
                }
              }
            ],
            "rank": [
              {
                "kind": "conditional",
                "condition": {
                  "kind": "winner-side",
                  "matchKey": "plan-v2/c/g/final/1/1",
                  "side": 1
                },
                "whenTrue": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/final/2/1"
                },
                "whenFalse": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/final/1/1"
                }
              },
              {
                "kind": "conditional",
                "condition": {
                  "kind": "winner-side",
                  "matchKey": "plan-v2/c/g/final/1/1",
                  "side": 1
                },
                "whenTrue": {
                  "kind": "loser",
                  "matchKey": "plan-v2/c/g/final/2/1"
                },
                "whenFalse": {
                  "kind": "loser",
                  "matchKey": "plan-v2/c/g/final/1/1"
                }
              }
            ]
          },
          "matches": [
            {
              "planKey": "plan-v2/c/g/upper/1/1",
              "role": "upper",
              "round": 1,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "upper",
                  "position": 1,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "upper",
                  "position": 8,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/upper/1/2",
              "role": "upper",
              "round": 1,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "upper",
                  "position": 4,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "upper",
                  "position": 5,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/upper/1/3",
              "role": "upper",
              "round": 1,
              "index": 3,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "upper",
                  "position": 2,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "upper",
                  "position": 7,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/upper/1/4",
              "role": "upper",
              "round": 1,
              "index": 4,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "upper",
                  "position": 3,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "upper",
                  "position": 6,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/upper/2/1",
              "role": "upper",
              "round": 2,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/upper/1/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/upper/1/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/upper/1/1",
                "plan-v2/c/g/upper/1/2"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/upper/2/2",
              "role": "upper",
              "round": 2,
              "index": 2,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/upper/1/3"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/upper/1/4"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/upper/1/3",
                "plan-v2/c/g/upper/1/4"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/upper/3/1",
              "role": "upper",
              "round": 3,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/upper/2/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/upper/2/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/upper/2/1",
                "plan-v2/c/g/upper/2/2"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/lower/1/1",
              "role": "lower",
              "round": 1,
              "index": 1,
              "sources": [
                {
                  "kind": "loser",
                  "matchKey": "plan-v2/c/g/upper/1/1"
                },
                {
                  "kind": "loser",
                  "matchKey": "plan-v2/c/g/upper/1/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/upper/1/1",
                "plan-v2/c/g/upper/1/2"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/lower/1/2",
              "role": "lower",
              "round": 1,
              "index": 2,
              "sources": [
                {
                  "kind": "loser",
                  "matchKey": "plan-v2/c/g/upper/1/3"
                },
                {
                  "kind": "loser",
                  "matchKey": "plan-v2/c/g/upper/1/4"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/upper/1/3",
                "plan-v2/c/g/upper/1/4"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/lower/2/1",
              "role": "lower",
              "round": 2,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/lower/1/1"
                },
                {
                  "kind": "loser",
                  "matchKey": "plan-v2/c/g/upper/2/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/lower/1/1",
                "plan-v2/c/g/upper/2/2"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/lower/2/2",
              "role": "lower",
              "round": 2,
              "index": 2,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/lower/1/2"
                },
                {
                  "kind": "loser",
                  "matchKey": "plan-v2/c/g/upper/2/1"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/lower/1/2",
                "plan-v2/c/g/upper/2/1"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/lower/3/1",
              "role": "lower",
              "round": 3,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/lower/2/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/lower/2/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/lower/2/1",
                "plan-v2/c/g/lower/2/2"
              ],
              "wave": 4,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/lower/4/1",
              "role": "lower",
              "round": 4,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/lower/3/1"
                },
                {
                  "kind": "loser",
                  "matchKey": "plan-v2/c/g/upper/3/1"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/lower/3/1",
                "plan-v2/c/g/upper/3/1"
              ],
              "wave": 5,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/final/1/1",
              "role": "final",
              "round": 1,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/upper/3/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/lower/4/1"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/upper/3/1",
                "plan-v2/c/g/lower/4/1"
              ],
              "wave": 6,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/final/2/1",
              "role": "final",
              "round": 2,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/upper/3/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/lower/4/1"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/g/upper/3/1",
                "plan-v2/c/g/lower/4/1",
                "plan-v2/c/g/final/1/1"
              ],
              "wave": 7,
              "bestOf": 3,
              "condition": {
                "kind": "winner-side",
                "matchKey": "plan-v2/c/g/final/1/1",
                "side": 1
              }
            }
          ],
          "windows": [],
          "waves": [
            {
              "planKey": "plan-v2/c/g/wave/1/0",
              "number": 1,
              "previousWaveKey": null,
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/upper/1/1",
                "plan-v2/c/g/upper/1/2",
                "plan-v2/c/g/upper/1/3",
                "plan-v2/c/g/upper/1/4"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/2/0",
              "number": 2,
              "previousWaveKey": "plan-v2/c/g/wave/1/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/upper/2/1",
                "plan-v2/c/g/upper/2/2",
                "plan-v2/c/g/lower/1/1",
                "plan-v2/c/g/lower/1/2"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/3/0",
              "number": 3,
              "previousWaveKey": "plan-v2/c/g/wave/2/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/upper/3/1",
                "plan-v2/c/g/lower/2/1",
                "plan-v2/c/g/lower/2/2"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/4/0",
              "number": 4,
              "previousWaveKey": "plan-v2/c/g/wave/3/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/lower/3/1"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/5/0",
              "number": 5,
              "previousWaveKey": "plan-v2/c/g/wave/4/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/lower/4/1"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/6/0",
              "number": 6,
              "previousWaveKey": "plan-v2/c/g/wave/5/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/final/1/1"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/7/0",
              "number": 7,
              "previousWaveKey": "plan-v2/c/g/wave/6/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/final/2/1"
              ]
            }
          ],
          "confirmationProfile": "dependency-wave-v1"
        }
      ],
      "connections": []
    }
  },
  "[\"swiss-fixed-v1\",8,4,{\"roundCount\":3}]": {
    "structure": {
      "entrantKind": "individual",
      "structureVersion": "structure-v2",
      "routingVersion": "routing-v2",
      "stages": [
        {
          "id": "s",
          "name": "阶段",
          "order": 1,
          "format": "fixed-swiss",
          "ruleVersion": "swiss-fixed-v1",
          "groupSize": 8,
          "groupCount": 1,
          "qualifyCount": 4,
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "roundCount": 3,
            "allowDraw": false,
            "allowPlayerDoubleLoss": false,
            "points": {
              "win": 3,
              "draw": 1,
              "loss": 0,
              "doubleLoss": 0
            },
            "tiebreakers": [
              "points",
              "BH-points-v1",
              "netGames",
              "initialSeed"
            ],
            "firstPairing": "top-bottom"
          },
          "groups": [
            {
              "id": "g",
              "stageId": "s",
              "capacity": 8
            }
          ],
          "capacity": 8
        }
      ],
      "pools": [],
      "routes": []
    },
    "plan": {
      "version": "compiled-plan-v2",
      "configurationId": "c",
      "units": [
        {
          "unitKey": "plan-v2/c/g/unit/0/0",
          "stageId": "s",
          "groupId": "g",
          "format": "fixed-swiss",
          "ruleVersion": "swiss-fixed-v1",
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "roundCount": 3,
            "allowDraw": false,
            "allowPlayerDoubleLoss": false,
            "points": {
              "win": 3,
              "draw": 1,
              "loss": 0,
              "doubleLoss": 0
            },
            "tiebreakers": [
              "points",
              "BH-points-v1",
              "netGames",
              "initialSeed"
            ],
            "firstPairing": "top-bottom"
          },
          "inputs": [
            {
              "channel": "seed",
              "capacity": 8,
              "positionKind": "seed",
              "initialLosses": 0,
              "placementPorts": [
                "seed",
                "slot"
              ]
            }
          ],
          "outputs": {
            "qualification": [
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 1,
                "source": {
                  "kind": "standing",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "rank": 1
                }
              },
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 2,
                "source": {
                  "kind": "standing",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "rank": 2
                }
              },
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 3,
                "source": {
                  "kind": "standing",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "rank": 3
                }
              },
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 4,
                "source": {
                  "kind": "standing",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "rank": 4
                }
              }
            ],
            "rank": []
          },
          "matches": [],
          "windows": [
            {
              "planKey": "plan-v2/c/g/window/1/0",
              "round": 1,
              "source": {
                "kind": "pendingSwissRound",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "round": 1
              },
              "previousWindowKey": null
            },
            {
              "planKey": "plan-v2/c/g/window/2/0",
              "round": 2,
              "source": {
                "kind": "pendingSwissRound",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "round": 2
              },
              "previousWindowKey": "plan-v2/c/g/window/1/0"
            },
            {
              "planKey": "plan-v2/c/g/window/3/0",
              "round": 3,
              "source": {
                "kind": "pendingSwissRound",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "round": 3
              },
              "previousWindowKey": "plan-v2/c/g/window/2/0"
            }
          ],
          "waves": [],
          "confirmationProfile": "group-round-v1"
        }
      ],
      "connections": []
    }
  },
  "[\"round-robin-v2\",4,2,{}]": {
    "structure": {
      "entrantKind": "individual",
      "structureVersion": "structure-v2",
      "routingVersion": "routing-v2",
      "stages": [
        {
          "id": "s",
          "name": "阶段",
          "order": 1,
          "format": "round-robin",
          "ruleVersion": "round-robin-v2",
          "groupSize": 4,
          "groupCount": 1,
          "qualifyCount": 2,
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "cycleCount": 1,
            "allowDraw": false,
            "allowPlayerDoubleLoss": false,
            "points": {
              "win": 3,
              "draw": 1,
              "loss": 0,
              "doubleLoss": 0
            },
            "tiebreakers": [
              "points",
              "head-to-head-v1",
              "netGames",
              "manual-with-reason"
            ]
          },
          "groups": [
            {
              "id": "g",
              "stageId": "s",
              "capacity": 4
            }
          ],
          "capacity": 4
        }
      ],
      "pools": [],
      "routes": []
    },
    "plan": {
      "version": "compiled-plan-v2",
      "configurationId": "c",
      "units": [
        {
          "unitKey": "plan-v2/c/g/unit/0/0",
          "stageId": "s",
          "groupId": "g",
          "format": "round-robin",
          "ruleVersion": "round-robin-v2",
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "cycleCount": 1,
            "allowDraw": false,
            "allowPlayerDoubleLoss": false,
            "points": {
              "win": 3,
              "draw": 1,
              "loss": 0,
              "doubleLoss": 0
            },
            "tiebreakers": [
              "points",
              "head-to-head-v1",
              "netGames",
              "manual-with-reason"
            ]
          },
          "inputs": [
            {
              "channel": "seed",
              "capacity": 4,
              "positionKind": "seed",
              "initialLosses": 0,
              "placementPorts": [
                "seed",
                "slot"
              ]
            }
          ],
          "outputs": {
            "qualification": [
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 1,
                "source": {
                  "kind": "standing",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "rank": 1
                }
              },
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 2,
                "source": {
                  "kind": "standing",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "rank": 2
                }
              }
            ],
            "rank": []
          },
          "matches": [
            {
              "planKey": "plan-v2/c/g/roundRobin/1/1",
              "role": "roundRobin",
              "round": 1,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/1/2",
              "role": "roundRobin",
              "round": 1,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/2/1",
              "role": "roundRobin",
              "round": 2,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/2/2",
              "role": "roundRobin",
              "round": 2,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/3/1",
              "role": "roundRobin",
              "round": 3,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/3/2",
              "role": "roundRobin",
              "round": 3,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            }
          ],
          "windows": [],
          "waves": [
            {
              "planKey": "plan-v2/c/g/wave/1/0",
              "number": 1,
              "previousWaveKey": null,
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/roundRobin/1/1",
                "plan-v2/c/g/roundRobin/1/2"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/2/0",
              "number": 2,
              "previousWaveKey": "plan-v2/c/g/wave/1/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/roundRobin/2/1",
                "plan-v2/c/g/roundRobin/2/2"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/3/0",
              "number": 3,
              "previousWaveKey": "plan-v2/c/g/wave/2/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/roundRobin/3/1",
                "plan-v2/c/g/roundRobin/3/2"
              ]
            }
          ],
          "confirmationProfile": "group-round-v1"
        }
      ],
      "connections": []
    }
  },
  "[\"double-round-robin-v2\",4,2,{}]": {
    "structure": {
      "entrantKind": "individual",
      "structureVersion": "structure-v2",
      "routingVersion": "routing-v2",
      "stages": [
        {
          "id": "s",
          "name": "阶段",
          "order": 1,
          "format": "double-round-robin",
          "ruleVersion": "double-round-robin-v2",
          "groupSize": 4,
          "groupCount": 1,
          "qualifyCount": 2,
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "cycleCount": 2,
            "allowDraw": false,
            "allowPlayerDoubleLoss": false,
            "points": {
              "win": 3,
              "draw": 1,
              "loss": 0,
              "doubleLoss": 0
            },
            "tiebreakers": [
              "points",
              "head-to-head-v1",
              "netGames",
              "manual-with-reason"
            ]
          },
          "groups": [
            {
              "id": "g",
              "stageId": "s",
              "capacity": 4
            }
          ],
          "capacity": 4
        }
      ],
      "pools": [],
      "routes": []
    },
    "plan": {
      "version": "compiled-plan-v2",
      "configurationId": "c",
      "units": [
        {
          "unitKey": "plan-v2/c/g/unit/0/0",
          "stageId": "s",
          "groupId": "g",
          "format": "double-round-robin",
          "ruleVersion": "double-round-robin-v2",
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "cycleCount": 2,
            "allowDraw": false,
            "allowPlayerDoubleLoss": false,
            "points": {
              "win": 3,
              "draw": 1,
              "loss": 0,
              "doubleLoss": 0
            },
            "tiebreakers": [
              "points",
              "head-to-head-v1",
              "netGames",
              "manual-with-reason"
            ]
          },
          "inputs": [
            {
              "channel": "seed",
              "capacity": 4,
              "positionKind": "seed",
              "initialLosses": 0,
              "placementPorts": [
                "seed",
                "slot"
              ]
            }
          ],
          "outputs": {
            "qualification": [
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 1,
                "source": {
                  "kind": "standing",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "rank": 1
                }
              },
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 2,
                "source": {
                  "kind": "standing",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "rank": 2
                }
              }
            ],
            "rank": []
          },
          "matches": [
            {
              "planKey": "plan-v2/c/g/roundRobin/1/1",
              "role": "roundRobin",
              "round": 1,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/1/2",
              "role": "roundRobin",
              "round": 1,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/2/1",
              "role": "roundRobin",
              "round": 2,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/2/2",
              "role": "roundRobin",
              "round": 2,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/3/1",
              "role": "roundRobin",
              "round": 3,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/3/2",
              "role": "roundRobin",
              "round": 3,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/4/1",
              "role": "roundRobin",
              "round": 4,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 4,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/4/2",
              "role": "roundRobin",
              "round": 4,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 4,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/5/1",
              "role": "roundRobin",
              "round": 5,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 5,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/5/2",
              "role": "roundRobin",
              "round": 5,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 5,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/6/1",
              "role": "roundRobin",
              "round": 6,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 6,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/roundRobin/6/2",
              "role": "roundRobin",
              "round": 6,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 6,
              "bestOf": 3,
              "condition": null
            }
          ],
          "windows": [],
          "waves": [
            {
              "planKey": "plan-v2/c/g/wave/1/0",
              "number": 1,
              "previousWaveKey": null,
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/roundRobin/1/1",
                "plan-v2/c/g/roundRobin/1/2"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/2/0",
              "number": 2,
              "previousWaveKey": "plan-v2/c/g/wave/1/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/roundRobin/2/1",
                "plan-v2/c/g/roundRobin/2/2"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/3/0",
              "number": 3,
              "previousWaveKey": "plan-v2/c/g/wave/2/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/roundRobin/3/1",
                "plan-v2/c/g/roundRobin/3/2"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/4/0",
              "number": 4,
              "previousWaveKey": "plan-v2/c/g/wave/3/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/roundRobin/4/1",
                "plan-v2/c/g/roundRobin/4/2"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/5/0",
              "number": 5,
              "previousWaveKey": "plan-v2/c/g/wave/4/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/roundRobin/5/1",
                "plan-v2/c/g/roundRobin/5/2"
              ]
            },
            {
              "planKey": "plan-v2/c/g/wave/6/0",
              "number": 6,
              "previousWaveKey": "plan-v2/c/g/wave/5/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/roundRobin/6/1",
                "plan-v2/c/g/roundRobin/6/2"
              ]
            }
          ],
          "confirmationProfile": "group-round-v1"
        }
      ],
      "connections": []
    }
  },
  "mixed": {
    "structure": {
      "entrantKind": "individual",
      "structureVersion": "structure-v2",
      "routingVersion": "routing-v2",
      "stages": [
        {
          "id": "s",
          "name": "阶段",
          "order": 1,
          "format": "single-elimination",
          "ruleVersion": "single-cut-v2",
          "groupSize": 8,
          "groupCount": 1,
          "qualifyCount": 4,
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "bracketMode": "complete",
            "thirdPlace": false
          },
          "groups": [
            {
              "id": "g",
              "stageId": "s",
              "capacity": 8
            }
          ],
          "capacity": 8
        },
        {
          "id": "T",
          "name": "Final",
          "order": 2,
          "format": "single-elimination",
          "ruleVersion": "single-cut-v2",
          "groupSize": 8,
          "groupCount": 1,
          "qualifyCount": 1,
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "bracketMode": "complete",
            "thirdPlace": false
          },
          "groups": [
            {
              "id": "Tg",
              "stageId": "T",
              "capacity": 8
            }
          ],
          "capacity": 8
        }
      ],
      "pools": [],
      "routes": [
        {
          "id": "r",
          "source": {
            "stageId": "s",
            "groupId": "g",
            "port": "qualification"
          },
          "target": {
            "stageId": "T",
            "groupId": "Tg",
            "port": "seed"
          },
          "selector": {
            "kind": "rankRange",
            "from": 1,
            "to": 4
          },
          "quota": 4,
          "sort": [
            {
              "field": "initialSeed",
              "direction": "asc"
            }
          ],
          "placement": {
            "kind": "seed",
            "positions": [
              1,
              2,
              3,
              4
            ]
          }
        }
      ]
    },
    "plan": {
      "version": "compiled-plan-v2",
      "configurationId": "c",
      "units": [
        {
          "unitKey": "plan-v2/c/g/unit/0/0",
          "stageId": "s",
          "groupId": "g",
          "format": "single-elimination",
          "ruleVersion": "single-cut-v2",
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "bracketMode": "complete",
            "thirdPlace": false
          },
          "inputs": [
            {
              "channel": "seed",
              "capacity": 8,
              "positionKind": "seed",
              "initialLosses": 0,
              "placementPorts": [
                "seed",
                "slot"
              ]
            }
          ],
          "outputs": {
            "qualification": [
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 1,
                "source": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/1"
                }
              },
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 2,
                "source": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/2"
                }
              },
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 3,
                "source": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/3"
                }
              },
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/g/unit/0/0",
                "channel": "qualification",
                "index": 4,
                "source": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/g/elimination/1/4"
                }
              }
            ],
            "rank": []
          },
          "matches": [
            {
              "planKey": "plan-v2/c/g/elimination/1/1",
              "role": "elimination",
              "round": 1,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 8,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/2",
              "role": "elimination",
              "round": 1,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 5,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/3",
              "role": "elimination",
              "round": 1,
              "index": 3,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 7,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/g/elimination/1/4",
              "role": "elimination",
              "round": 1,
              "index": 4,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/g/unit/0/0",
                  "channel": "seed",
                  "position": 6,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            }
          ],
          "windows": [],
          "waves": [
            {
              "planKey": "plan-v2/c/g/wave/1/0",
              "number": 1,
              "previousWaveKey": null,
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/g/elimination/1/1",
                "plan-v2/c/g/elimination/1/2",
                "plan-v2/c/g/elimination/1/3",
                "plan-v2/c/g/elimination/1/4"
              ]
            }
          ],
          "confirmationProfile": "group-round-v1"
        },
        {
          "unitKey": "plan-v2/c/Tg/unit/0/0",
          "stageId": "T",
          "groupId": "Tg",
          "format": "single-elimination",
          "ruleVersion": "single-cut-v2",
          "parameters": {
            "defaultBO": 3,
            "seeding": {
              "kind": "seed",
              "seedTableVersion": "recursive-v1"
            },
            "overrides": {},
            "bracketMode": "complete",
            "thirdPlace": false
          },
          "inputs": [
            {
              "channel": "seed",
              "capacity": 8,
              "positionKind": "seed",
              "initialLosses": 0,
              "placementPorts": [
                "seed",
                "slot"
              ]
            }
          ],
          "outputs": {
            "qualification": [
              {
                "kind": "qualification",
                "unitKey": "plan-v2/c/Tg/unit/0/0",
                "channel": "qualification",
                "index": 1,
                "source": {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/Tg/final/3/1"
                }
              }
            ],
            "rank": [
              {
                "kind": "winner",
                "matchKey": "plan-v2/c/Tg/final/3/1"
              },
              {
                "kind": "loser",
                "matchKey": "plan-v2/c/Tg/final/3/1"
              }
            ],
            "tiedRanks": [
              {
                "rank": 3,
                "sources": [
                  {
                    "kind": "loser",
                    "matchKey": "plan-v2/c/Tg/elimination/2/1"
                  },
                  {
                    "kind": "loser",
                    "matchKey": "plan-v2/c/Tg/elimination/2/2"
                  }
                ]
              }
            ]
          },
          "matches": [
            {
              "planKey": "plan-v2/c/Tg/elimination/1/1",
              "role": "elimination",
              "round": 1,
              "index": 1,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/Tg/unit/0/0",
                  "channel": "seed",
                  "position": 1,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/Tg/unit/0/0",
                  "channel": "seed",
                  "position": 8,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/Tg/elimination/1/2",
              "role": "elimination",
              "round": 1,
              "index": 2,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/Tg/unit/0/0",
                  "channel": "seed",
                  "position": 4,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/Tg/unit/0/0",
                  "channel": "seed",
                  "position": 5,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/Tg/elimination/1/3",
              "role": "elimination",
              "round": 1,
              "index": 3,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/Tg/unit/0/0",
                  "channel": "seed",
                  "position": 2,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/Tg/unit/0/0",
                  "channel": "seed",
                  "position": 7,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/Tg/elimination/1/4",
              "role": "elimination",
              "round": 1,
              "index": 4,
              "sources": [
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/Tg/unit/0/0",
                  "channel": "seed",
                  "position": 3,
                  "initialLosses": 0
                },
                {
                  "kind": "entrant",
                  "unitKey": "plan-v2/c/Tg/unit/0/0",
                  "channel": "seed",
                  "position": 6,
                  "initialLosses": 0
                }
              ],
              "dependencyKeys": [],
              "wave": 1,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/Tg/elimination/2/1",
              "role": "elimination",
              "round": 2,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/Tg/elimination/1/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/Tg/elimination/1/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/Tg/elimination/1/1",
                "plan-v2/c/Tg/elimination/1/2"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/Tg/elimination/2/2",
              "role": "elimination",
              "round": 2,
              "index": 2,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/Tg/elimination/1/3"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/Tg/elimination/1/4"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/Tg/elimination/1/3",
                "plan-v2/c/Tg/elimination/1/4"
              ],
              "wave": 2,
              "bestOf": 3,
              "condition": null
            },
            {
              "planKey": "plan-v2/c/Tg/final/3/1",
              "role": "final",
              "round": 3,
              "index": 1,
              "sources": [
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/Tg/elimination/2/1"
                },
                {
                  "kind": "winner",
                  "matchKey": "plan-v2/c/Tg/elimination/2/2"
                }
              ],
              "dependencyKeys": [
                "plan-v2/c/Tg/elimination/2/1",
                "plan-v2/c/Tg/elimination/2/2"
              ],
              "wave": 3,
              "bestOf": 3,
              "condition": null
            }
          ],
          "windows": [],
          "waves": [
            {
              "planKey": "plan-v2/c/Tg/wave/1/0",
              "number": 1,
              "previousWaveKey": null,
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/Tg/elimination/1/1",
                "plan-v2/c/Tg/elimination/1/2",
                "plan-v2/c/Tg/elimination/1/3",
                "plan-v2/c/Tg/elimination/1/4"
              ]
            },
            {
              "planKey": "plan-v2/c/Tg/wave/2/0",
              "number": 2,
              "previousWaveKey": "plan-v2/c/Tg/wave/1/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/Tg/elimination/2/1",
                "plan-v2/c/Tg/elimination/2/2"
              ]
            },
            {
              "planKey": "plan-v2/c/Tg/wave/3/0",
              "number": 3,
              "previousWaveKey": "plan-v2/c/Tg/wave/2/0",
              "requiresAllDecisions": true,
              "conditionalPolicy": "active-matches-only",
              "matches": [
                "plan-v2/c/Tg/final/3/1"
              ]
            }
          ],
          "confirmationProfile": "group-round-v1"
        }
      ],
      "connections": [
        {
          "planKey": "plan-v2/c/route/r",
          "routeId": "r",
          "source": {
            "kind": "unit",
            "unitKey": "plan-v2/c/g/unit/0/0",
            "port": "qualification"
          },
          "target": {
            "kind": "unit",
            "unitKey": "plan-v2/c/Tg/unit/0/0",
            "port": "seed"
          },
          "selector": {
            "kind": "rankRange",
            "from": 1,
            "to": 4
          },
          "quota": 4,
          "sort": [
            {
              "field": "initialSeed",
              "direction": "asc"
            }
          ],
          "placement": {
            "kind": "seed",
            "positions": [
              1,
              2,
              3,
              4
            ]
          }
        }
      ]
    }
  }
};
