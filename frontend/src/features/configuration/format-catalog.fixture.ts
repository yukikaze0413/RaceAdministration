// Captured server format catalog DTO.
export const catalog = {
  version: "format-catalog-v1",
  structureVersion: "structure-v2",
  routingVersion: "routing-v2",
  formats: [
    {
      ruleVersion: "single-cut-v2",
      format: "single-elimination",
      label: "单败淘汰",
      runtimeReady: true,
      defaults: {
        groupSize: 8,
        groupCount: 1,
        qualifyCount: 1,
        parameters: {
          defaultBO: 3,
          seeding: {
            kind: "seed",
            seedTableVersion: "recursive-v1",
          },
          overrides: {},
          bracketMode: "complete",
          thirdPlace: false,
        },
      },
      parameterSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          defaultBO: {
            type: "integer",
            enum: [1, 3, 5, 7],
          },
          seeding: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                enum: ["seed", "slot"],
              },
              seedTableVersion: {
                type: "string",
                enum: ["recursive-v1"],
              },
            },
          },
          overrides: {
            type: "object",
            additionalProperties: false,
            properties: {
              final: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              thirdPlace: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              rounds: {
                type: "object",
                additionalProperties: false,
                properties: {
                  "1": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "2": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "3": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "4": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "5": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "6": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "7": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "8": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "9": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "10": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "11": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "12": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "13": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "14": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "15": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "16": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "17": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "18": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "19": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "20": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "21": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "22": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "23": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "24": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "25": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "26": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "27": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "28": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "29": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "30": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "31": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "32": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "33": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "34": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "35": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "36": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "37": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "38": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "39": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "40": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "41": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "42": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "43": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "44": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "45": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "46": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "47": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "48": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "49": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "50": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "51": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "52": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "53": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "54": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "55": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "56": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "57": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "58": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "59": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "60": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "61": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "62": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "63": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "64": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                },
              },
            },
          },
          bracketMode: {
            type: "string",
            enum: ["complete", "segmented"],
          },
          thirdPlace: {
            type: "boolean",
          },
        },
      },
      confirmationProfile: "group-round-v1",
    },
    {
      ruleVersion: "gsl-classic-v1",
      format: "gsl",
      label: "经典GSL",
      runtimeReady: true,
      defaults: {
        groupSize: 4,
        groupCount: 4,
        qualifyCount: 2,
        parameters: {
          defaultBO: 3,
          seeding: {
            kind: "seed",
            seedTableVersion: "recursive-v1",
          },
          overrides: {},
        },
      },
      parameterSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          defaultBO: {
            type: "integer",
            enum: [1, 3, 5, 7],
          },
          seeding: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                enum: ["seed", "slot"],
              },
              seedTableVersion: {
                type: "string",
                enum: ["recursive-v1"],
              },
            },
          },
          overrides: {
            type: "object",
            additionalProperties: false,
            properties: {
              opening: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              winners: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              elimination: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              decider: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              rounds: {
                type: "object",
                additionalProperties: false,
                properties: {
                  "1": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "2": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "3": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "4": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "5": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "6": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "7": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "8": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "9": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "10": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "11": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "12": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "13": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "14": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "15": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "16": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "17": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "18": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "19": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "20": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "21": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "22": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "23": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "24": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "25": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "26": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "27": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "28": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "29": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "30": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "31": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "32": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "33": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "34": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "35": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "36": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "37": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "38": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "39": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "40": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "41": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "42": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "43": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "44": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "45": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "46": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "47": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "48": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "49": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "50": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "51": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "52": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "53": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "54": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "55": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "56": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "57": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "58": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "59": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "60": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "61": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "62": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "63": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "64": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                },
              },
            },
          },
        },
      },
      confirmationProfile: "dependency-wave-v1",
    },
    {
      ruleVersion: "de-standard-v1",
      format: "double-elimination",
      label: "标准双败",
      runtimeReady: true,
      defaults: {
        groupSize: 8,
        groupCount: 1,
        qualifyCount: 1,
        parameters: {
          defaultBO: 3,
          seeding: {
            kind: "seed",
            seedTableVersion: "recursive-v1",
          },
          overrides: {},
          lowerEntryMode: "disabled",
          finalReset: false,
        },
      },
      parameterSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          defaultBO: {
            type: "integer",
            enum: [1, 3, 5, 7],
          },
          seeding: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                enum: ["seed", "slot"],
              },
              seedTableVersion: {
                type: "string",
                enum: ["recursive-v1"],
              },
            },
          },
          overrides: {
            type: "object",
            additionalProperties: false,
            properties: {
              upper: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              lower: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              final: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              rounds: {
                type: "object",
                additionalProperties: false,
                properties: {
                  "1": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "2": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "3": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "4": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "5": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "6": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "7": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "8": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "9": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "10": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "11": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "12": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "13": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "14": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "15": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "16": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "17": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "18": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "19": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "20": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "21": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "22": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "23": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "24": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "25": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "26": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "27": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "28": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "29": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "30": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "31": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "32": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "33": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "34": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "35": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "36": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "37": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "38": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "39": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "40": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "41": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "42": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "43": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "44": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "45": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "46": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "47": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "48": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "49": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "50": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "51": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "52": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "53": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "54": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "55": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "56": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "57": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "58": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "59": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "60": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "61": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "62": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "63": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "64": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                },
              },
            },
          },
          lowerEntryMode: {
            type: "string",
            enum: ["disabled"],
          },
          finalReset: {
            type: "boolean",
          },
        },
      },
      confirmationProfile: "dependency-wave-v1",
    },
    {
      ruleVersion: "de-lower-entry-v1",
      format: "double-elimination",
      label: "双败及败者直接输入",
      runtimeReady: true,
      defaults: {
        groupSize: 8,
        groupCount: 1,
        qualifyCount: 1,
        parameters: {
          defaultBO: 3,
          seeding: {
            kind: "seed",
            seedTableVersion: "recursive-v1",
          },
          overrides: {},
          lowerEntryMode: "disabled",
          finalReset: false,
        },
      },
      parameterSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          defaultBO: {
            type: "integer",
            enum: [1, 3, 5, 7],
          },
          seeding: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                enum: ["seed", "slot"],
              },
              seedTableVersion: {
                type: "string",
                enum: ["recursive-v1"],
              },
            },
          },
          overrides: {
            type: "object",
            additionalProperties: false,
            properties: {
              upper: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              lower: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              final: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              rounds: {
                type: "object",
                additionalProperties: false,
                properties: {
                  "1": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "2": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "3": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "4": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "5": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "6": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "7": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "8": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "9": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "10": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "11": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "12": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "13": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "14": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "15": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "16": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "17": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "18": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "19": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "20": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "21": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "22": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "23": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "24": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "25": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "26": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "27": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "28": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "29": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "30": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "31": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "32": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "33": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "34": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "35": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "36": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "37": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "38": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "39": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "40": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "41": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "42": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "43": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "44": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "45": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "46": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "47": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "48": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "49": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "50": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "51": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "52": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "53": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "54": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "55": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "56": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "57": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "58": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "59": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "60": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "61": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "62": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "63": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "64": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                },
              },
            },
          },
          lowerEntryMode: {
            type: "string",
            enum: ["disabled", "same", "half"],
          },
          finalReset: {
            type: "boolean",
          },
        },
      },
      confirmationProfile: "dependency-wave-v1",
    },
    {
      ruleVersion: "swiss-fixed-v1",
      format: "fixed-swiss",
      label: "固定轮数瑞士",
      runtimeReady: true,
      defaults: {
        groupSize: 16,
        groupCount: 1,
        qualifyCount: 8,
        parameters: {
          defaultBO: 3,
          seeding: {
            kind: "seed",
            seedTableVersion: "recursive-v1",
          },
          overrides: {},
          roundCount: 4,
          allowDraw: false,
          allowPlayerDoubleLoss: false,
          points: {
            win: 3,
            draw: 1,
            loss: 0,
            doubleLoss: 0,
          },
          tiebreakers: ["points", "BH-points-v1", "netGames", "initialSeed"],
          firstPairing: "top-bottom",
        },
      },
      parameterSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          defaultBO: {
            type: "integer",
            enum: [1, 3, 5, 7],
          },
          seeding: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                enum: ["seed", "slot"],
              },
              seedTableVersion: {
                type: "string",
                enum: ["recursive-v1"],
              },
            },
          },
          overrides: {
            type: "object",
            additionalProperties: false,
            properties: {
              rounds: {
                type: "object",
                additionalProperties: false,
                properties: {
                  "1": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "2": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "3": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "4": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "5": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "6": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "7": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "8": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "9": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "10": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "11": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "12": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "13": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "14": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "15": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "16": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "17": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "18": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "19": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "20": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "21": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "22": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "23": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "24": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "25": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "26": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "27": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "28": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "29": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "30": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "31": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "32": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "33": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "34": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "35": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "36": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "37": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "38": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "39": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "40": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "41": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "42": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "43": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "44": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "45": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "46": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "47": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "48": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "49": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "50": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "51": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "52": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "53": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "54": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "55": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "56": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "57": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "58": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "59": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "60": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "61": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "62": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "63": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "64": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                },
              },
            },
          },
          roundCount: {
            type: "integer",
            minimum: 1,
            maximum: 64,
          },
          allowDraw: {
            type: "boolean",
          },
          allowPlayerDoubleLoss: {
            type: "boolean",
          },
          points: {
            type: "object",
            additionalProperties: false,
            properties: {
              win: {
                type: "integer",
                minimum: 0,
                maximum: 9007199254740991,
              },
              draw: {
                type: "integer",
                minimum: 0,
                maximum: 9007199254740991,
              },
              loss: {
                type: "integer",
                minimum: 0,
                maximum: 9007199254740991,
              },
              doubleLoss: {
                type: "integer",
                minimum: 0,
                maximum: 9007199254740991,
              },
            },
          },
          tiebreakers: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "points",
                "BH-points-v1",
                "netGames",
                "initialSeed",
                "manual-with-reason",
              ],
            },
            minItems: 1,
            uniqueItems: true,
          },
          firstPairing: {
            type: "string",
            enum: ["top-bottom"],
          },
        },
      },
      confirmationProfile: "group-round-v1",
    },
    {
      ruleVersion: "swiss-threshold-v1",
      format: "threshold-swiss",
      label: "胜负阈值瑞士",
      runtimeReady: true,
      defaults: {
        groupSize: 16,
        groupCount: 1,
        qualifyCount: 8,
        parameters: {
          defaultBO: 3,
          seeding: {
            kind: "seed",
            seedTableVersion: "recursive-v1",
          },
          overrides: {},
          winsToQualify: 3,
          lossesToEliminate: 3,
          allowDraw: false,
          allowPlayerDoubleLoss: false,
          tiebreakers: ["record", "DS-wl-v1", "initialSeed"],
          firstPairing: "top-bottom",
        },
      },
      parameterSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          defaultBO: {
            type: "integer",
            enum: [1, 3, 5, 7],
          },
          seeding: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                enum: ["seed", "slot"],
              },
              seedTableVersion: {
                type: "string",
                enum: ["recursive-v1"],
              },
            },
          },
          overrides: {
            type: "object",
            additionalProperties: false,
            properties: {
              advancement: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              elimination: {
                type: "integer",
                enum: [1, 3, 5, 7],
              },
              rounds: {
                type: "object",
                additionalProperties: false,
                properties: {
                  "1": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "2": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "3": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "4": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "5": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "6": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "7": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "8": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "9": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "10": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "11": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "12": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "13": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "14": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "15": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "16": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "17": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "18": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "19": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "20": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "21": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "22": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "23": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "24": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "25": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "26": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "27": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "28": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "29": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "30": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "31": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "32": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "33": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "34": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "35": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "36": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "37": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "38": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "39": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "40": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "41": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "42": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "43": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "44": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "45": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "46": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "47": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "48": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "49": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "50": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "51": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "52": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "53": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "54": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "55": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "56": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "57": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "58": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "59": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "60": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "61": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "62": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "63": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "64": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                },
              },
            },
          },
          winsToQualify: {
            type: "integer",
            minimum: 1,
            maximum: 5,
          },
          lossesToEliminate: {
            type: "integer",
            minimum: 1,
            maximum: 5,
          },
          allowDraw: {
            type: "boolean",
            enum: [false],
          },
          allowPlayerDoubleLoss: {
            type: "boolean",
          },
          tiebreakers: {
            type: "array",
            items: {
              type: "string",
              enum: ["record", "DS-wl-v1", "initialSeed", "manual-with-reason"],
            },
            minItems: 1,
            uniqueItems: true,
          },
          firstPairing: {
            type: "string",
            enum: ["top-bottom"],
          },
        },
      },
      confirmationProfile: "group-round-v1",
    },
    {
      ruleVersion: "major-cologne-2026-v1",
      format: "threshold-swiss",
      label: "科隆Major 2026专用瑞士",
      runtimeReady: true,
      defaults: {
        groupSize: 16,
        groupCount: 1,
        qualifyCount: 8,
        parameters: {
          defaultBO: 3,
          seeding: {
            kind: "seed",
            seedTableVersion: "recursive-v1",
          },
          overrides: {
            advancement: 3,
            elimination: 3,
          },
          winsToQualify: 3,
          lossesToEliminate: 3,
          allowDraw: false,
          allowPlayerDoubleLoss: false,
          tiebreakers: ["record", "DS-wl-v1", "initialSeed"],
          firstPairing: "top-bottom",
        },
      },
      parameterSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          defaultBO: {
            type: "integer",
            enum: [1, 3],
          },
          seeding: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                enum: ["seed"],
              },
              seedTableVersion: {
                type: "string",
                enum: ["recursive-v1"],
              },
            },
          },
          overrides: {
            type: "object",
            additionalProperties: false,
            properties: {
              advancement: {
                type: "integer",
                enum: [3],
              },
              elimination: {
                type: "integer",
                enum: [3],
              },
              rounds: {
                type: "object",
                additionalProperties: false,
                properties: {},
              },
            },
          },
          winsToQualify: {
            type: "integer",
            enum: [3],
          },
          lossesToEliminate: {
            type: "integer",
            enum: [3],
          },
          allowDraw: {
            type: "boolean",
            enum: [false],
          },
          allowPlayerDoubleLoss: {
            type: "boolean",
            enum: [false],
          },
          tiebreakers: {
            type: "array",
            items: {
              type: "string",
              enum: ["record", "DS-wl-v1", "initialSeed"],
            },
            minItems: 3,
            uniqueItems: true,
          },
          firstPairing: {
            type: "string",
            enum: ["top-bottom"],
          },
        },
      },
      confirmationProfile: "group-round-v1",
    },
    {
      ruleVersion: "ti2026-observed-candidate-v1",
      format: "threshold-swiss",
      label: "TI2026候选计划（待验证）",
      runtimeReady: false,
      unavailableReason: "FORMAT_RUNTIME_UNAVAILABLE",
      defaults: {
        groupSize: 16,
        groupCount: 1,
        qualifyCount: 8,
        parameters: {
          defaultBO: 3,
          seeding: {
            kind: "slot",
            seedTableVersion: "ti-organizer-slot-v1",
          },
          overrides: {},
          roundCount: 5,
          winsToQualify: 4,
          lossesToEliminate: 4,
          allowDraw: false,
          allowPlayerDoubleLoss: false,
          tiebreakers: [
            "record",
            "TI-opponent-wins-v1",
            "TI-game-pct-observed-v1",
            "TI-opponent-game-pct-observed-v1",
            "TI-duration-observed-v1",
            "coin-toss-with-reason",
          ],
          firstPairing: "organizer-slot-pairs-v1",
        },
      },
      parameterSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          defaultBO: {
            type: "integer",
            enum: [3],
          },
          seeding: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                enum: ["slot"],
              },
              seedTableVersion: {
                type: "string",
                enum: ["ti-organizer-slot-v1"],
              },
            },
          },
          overrides: {
            type: "object",
            additionalProperties: false,
            properties: {},
          },
          roundCount: {
            type: "integer",
            enum: [5],
          },
          winsToQualify: {
            type: "integer",
            enum: [4],
          },
          lossesToEliminate: {
            type: "integer",
            enum: [4],
          },
          allowDraw: {
            type: "boolean",
            enum: [false],
          },
          allowPlayerDoubleLoss: {
            type: "boolean",
            enum: [false],
          },
          tiebreakers: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "record",
                "TI-opponent-wins-v1",
                "TI-game-pct-observed-v1",
                "TI-opponent-game-pct-observed-v1",
                "TI-duration-observed-v1",
                "coin-toss-with-reason",
              ],
            },
            minItems: 6,
            uniqueItems: true,
          },
          firstPairing: {
            type: "string",
            enum: ["organizer-slot-pairs-v1"],
          },
        },
      },
      confirmationProfile: "group-round-v1",
    },
    {
      ruleVersion: "round-robin-v2",
      format: "round-robin",
      label: "单循环",
      runtimeReady: true,
      defaults: {
        groupSize: 4,
        groupCount: 1,
        qualifyCount: 2,
        parameters: {
          defaultBO: 3,
          seeding: {
            kind: "seed",
            seedTableVersion: "recursive-v1",
          },
          overrides: {},
          cycleCount: 1,
          allowDraw: false,
          allowPlayerDoubleLoss: false,
          points: {
            win: 3,
            draw: 1,
            loss: 0,
            doubleLoss: 0,
          },
          tiebreakers: [
            "points",
            "head-to-head-v1",
            "netGames",
            "manual-with-reason",
          ],
        },
      },
      parameterSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          defaultBO: {
            type: "integer",
            enum: [1, 3, 5, 7],
          },
          seeding: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                enum: ["seed", "slot"],
              },
              seedTableVersion: {
                type: "string",
                enum: ["recursive-v1"],
              },
            },
          },
          overrides: {
            type: "object",
            additionalProperties: false,
            properties: {
              rounds: {
                type: "object",
                additionalProperties: false,
                properties: {
                  "1": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "2": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "3": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "4": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "5": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "6": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "7": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "8": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "9": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "10": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "11": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "12": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "13": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "14": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "15": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "16": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "17": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "18": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "19": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "20": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "21": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "22": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "23": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "24": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "25": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "26": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "27": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "28": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "29": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "30": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "31": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "32": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "33": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "34": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "35": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "36": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "37": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "38": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "39": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "40": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "41": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "42": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "43": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "44": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "45": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "46": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "47": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "48": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "49": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "50": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "51": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "52": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "53": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "54": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "55": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "56": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "57": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "58": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "59": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "60": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "61": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "62": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "63": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "64": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                },
              },
            },
          },
          cycleCount: {
            type: "integer",
            enum: [1],
          },
          allowDraw: {
            type: "boolean",
          },
          allowPlayerDoubleLoss: {
            type: "boolean",
          },
          points: {
            type: "object",
            additionalProperties: false,
            properties: {
              win: {
                type: "integer",
                minimum: 0,
                maximum: 9007199254740991,
              },
              draw: {
                type: "integer",
                minimum: 0,
                maximum: 9007199254740991,
              },
              loss: {
                type: "integer",
                minimum: 0,
                maximum: 9007199254740991,
              },
              doubleLoss: {
                type: "integer",
                minimum: 0,
                maximum: 9007199254740991,
              },
            },
          },
          tiebreakers: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "points",
                "head-to-head-v1",
                "netGames",
                "manual-with-reason",
              ],
            },
            minItems: 1,
            uniqueItems: true,
          },
        },
      },
      confirmationProfile: "group-round-v1",
    },
    {
      ruleVersion: "double-round-robin-v2",
      format: "double-round-robin",
      label: "双循环",
      runtimeReady: true,
      defaults: {
        groupSize: 4,
        groupCount: 1,
        qualifyCount: 2,
        parameters: {
          defaultBO: 3,
          seeding: {
            kind: "seed",
            seedTableVersion: "recursive-v1",
          },
          overrides: {},
          cycleCount: 2,
          allowDraw: false,
          allowPlayerDoubleLoss: false,
          points: {
            win: 3,
            draw: 1,
            loss: 0,
            doubleLoss: 0,
          },
          tiebreakers: [
            "points",
            "head-to-head-v1",
            "netGames",
            "manual-with-reason",
          ],
        },
      },
      parameterSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          defaultBO: {
            type: "integer",
            enum: [1, 3, 5, 7],
          },
          seeding: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                enum: ["seed", "slot"],
              },
              seedTableVersion: {
                type: "string",
                enum: ["recursive-v1"],
              },
            },
          },
          overrides: {
            type: "object",
            additionalProperties: false,
            properties: {
              rounds: {
                type: "object",
                additionalProperties: false,
                properties: {
                  "1": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "2": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "3": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "4": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "5": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "6": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "7": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "8": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "9": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "10": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "11": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "12": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "13": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "14": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "15": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "16": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "17": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "18": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "19": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "20": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "21": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "22": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "23": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "24": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "25": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "26": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "27": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "28": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "29": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "30": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "31": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "32": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "33": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "34": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "35": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "36": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "37": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "38": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "39": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "40": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "41": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "42": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "43": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "44": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "45": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "46": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "47": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "48": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "49": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "50": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "51": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "52": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "53": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "54": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "55": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "56": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "57": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "58": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "59": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "60": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "61": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "62": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "63": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                  "64": {
                    type: "integer",
                    enum: [1, 3, 5, 7],
                  },
                },
              },
            },
          },
          cycleCount: {
            type: "integer",
            enum: [2],
          },
          allowDraw: {
            type: "boolean",
          },
          allowPlayerDoubleLoss: {
            type: "boolean",
          },
          points: {
            type: "object",
            additionalProperties: false,
            properties: {
              win: {
                type: "integer",
                minimum: 0,
                maximum: 9007199254740991,
              },
              draw: {
                type: "integer",
                minimum: 0,
                maximum: 9007199254740991,
              },
              loss: {
                type: "integer",
                minimum: 0,
                maximum: 9007199254740991,
              },
              doubleLoss: {
                type: "integer",
                minimum: 0,
                maximum: 9007199254740991,
              },
            },
          },
          tiebreakers: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "points",
                "head-to-head-v1",
                "netGames",
                "manual-with-reason",
              ],
            },
            minItems: 1,
            uniqueItems: true,
          },
        },
      },
      confirmationProfile: "group-round-v1",
    },
  ],
};
