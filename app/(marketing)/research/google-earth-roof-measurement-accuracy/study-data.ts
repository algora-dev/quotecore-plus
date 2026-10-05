// Auto-generated from public/downloads/quote-core-google-earth-roof-measurement-study-2026.csv - do not hand-edit values.
// Regenerate with: node scripts/gen-study-data.mjs
export interface StudyComponent { type: string; entry: string; digital: number; physical: number; unit: string; difference: number; absVar: number; note: string | null; }
export interface StudyRoof {
  id: string; slug: string; country: string; complexity: string; feature: boolean;
  digitalTime: string; siteTime: string; digitalPitch: number; sitePitch: number;
  area: { digital: number; physical: number; variance: number };
  components: StudyComponent[]; componentsChecked: number; within5: number; within10: number;
  timeSaved: number; note: string | null;
}
export const studyRoofs: StudyRoof[] = [
  {
    "id": "NZ-01",
    "country": "New Zealand",
    "complexity": "simple",
    "feature": false,
    "digitalTime": "2:27",
    "siteTime": "9:03",
    "digitalPitch": 7,
    "sitePitch": 7.5,
    "area": {
      "digital": 237.63,
      "physical": 232.5,
      "variance": 2.206
    },
    "components": [
      {
        "type": "Ridge",
        "entry": "1",
        "digital": 16.78,
        "physical": 16.6,
        "unit": "m",
        "difference": 0.18,
        "absVar": 1.084,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "Hidden section",
        "digital": 2.1,
        "physical": 3,
        "unit": "m",
        "difference": -0.9,
        "absVar": 30,
        "note": "Known remote-imagery visibility limitation: this lower-roof head barge extended beneath the upper roof/soffit. Only the exposed ~2.10 m was visible remotely; site measurement showed the full length was 3.00 m."
      },
      {
        "type": "Ridge",
        "entry": "3",
        "digital": 14.94,
        "physical": 14.9,
        "unit": "m",
        "difference": 0.04,
        "absVar": 0.268,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "1",
        "digital": 7.97,
        "physical": 7.8,
        "unit": "m",
        "difference": 0.17,
        "absVar": 2.179,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "2",
        "digital": 1.2,
        "physical": 1.1,
        "unit": "m",
        "difference": 0.1,
        "absVar": 9.091,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "3",
        "digital": 6.77,
        "physical": 6.7,
        "unit": "m",
        "difference": 0.07,
        "absVar": 1.045,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "4",
        "digital": 6.59,
        "physical": 6.4,
        "unit": "m",
        "difference": 0.19,
        "absVar": 2.969,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "5",
        "digital": 6.69,
        "physical": 6.4,
        "unit": "m",
        "difference": 0.29,
        "absVar": 4.531,
        "note": null
      },
      {
        "type": "Spouting",
        "entry": "1",
        "digital": 14.8,
        "physical": 14.9,
        "unit": "m",
        "difference": -0.1,
        "absVar": 0.671,
        "note": null
      },
      {
        "type": "Spouting",
        "entry": "2",
        "digital": 2.16,
        "physical": 3,
        "unit": "m",
        "difference": -0.84,
        "absVar": 28,
        "note": "Known remote-imagery visibility limitation: this lower-roof spouting length continued beneath the upper roof/soffit. Only the exposed ~2.16 m was visible remotely; site measurement showed the full length was 3.00 m."
      },
      {
        "type": "Spouting",
        "entry": "3",
        "digital": 9.01,
        "physical": 8.9,
        "unit": "m",
        "difference": 0.11,
        "absVar": 1.236,
        "note": null
      },
      {
        "type": "Spouting",
        "entry": "4",
        "digital": 7.46,
        "physical": 7.2,
        "unit": "m",
        "difference": 0.26,
        "absVar": 3.611,
        "note": null
      }
    ],
    "note": "Featured visibility-limit example: part of a lower roof was hidden beneath upper roof/soffit geometry and could not be identified from the available top-down and Street View views. Two short edge measurements were therefore substantially under-measured.",
    "slug": "nz-01",
    "componentsChecked": 12,
    "within5": 9,
    "within10": 10,
    "timeSaved": 72.9
  },
  {
    "id": "NZ-02",
    "country": "New Zealand",
    "complexity": "simple",
    "feature": false,
    "digitalTime": "2:39",
    "siteTime": "11:10",
    "digitalPitch": 33,
    "sitePitch": 35,
    "area": {
      "digital": 233.95,
      "physical": 215,
      "variance": 8.814
    },
    "components": [
      {
        "type": "Ridge",
        "entry": "1",
        "digital": 4.52,
        "physical": 4.4,
        "unit": "m",
        "difference": 0.12,
        "absVar": 2.727,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "2",
        "digital": 14.64,
        "physical": 14.2,
        "unit": "m",
        "difference": 0.44,
        "absVar": 3.099,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "1",
        "digital": 7.06,
        "physical": 7,
        "unit": "m",
        "difference": 0.06,
        "absVar": 0.857,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "2",
        "digital": 7.16,
        "physical": 7,
        "unit": "m",
        "difference": 0.16,
        "absVar": 2.286,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "3",
        "digital": 0.78,
        "physical": 0.7,
        "unit": "m",
        "difference": 0.08,
        "absVar": 11.429,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "4",
        "digital": 0.79,
        "physical": 0.7,
        "unit": "m",
        "difference": 0.09,
        "absVar": 12.857,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "5",
        "digital": 3.31,
        "physical": 3.3,
        "unit": "m",
        "difference": 0.01,
        "absVar": 0.303,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "6",
        "digital": 2.46,
        "physical": 2.4,
        "unit": "m",
        "difference": 0.06,
        "absVar": 2.5,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "7",
        "digital": 3.74,
        "physical": 3.7,
        "unit": "m",
        "difference": 0.04,
        "absVar": 1.081,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "8",
        "digital": 7.18,
        "physical": 7.1,
        "unit": "m",
        "difference": 0.08,
        "absVar": 1.127,
        "note": null
      }
    ],
    "note": null,
    "slug": "nz-02",
    "componentsChecked": 10,
    "within5": 8,
    "within10": 8,
    "timeSaved": 76.3
  },
  {
    "id": "NZ-03",
    "country": "New Zealand",
    "complexity": "Medium",
    "feature": false,
    "digitalTime": "2:56",
    "siteTime": "12:56",
    "digitalPitch": 27,
    "sitePitch": 25,
    "area": {
      "digital": 309.12,
      "physical": 301,
      "variance": 2.698
    },
    "components": [
      {
        "type": "Ridge",
        "entry": "1",
        "digital": 4.97,
        "physical": 5.1,
        "unit": "m",
        "difference": -0.13,
        "absVar": 2.549,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "2",
        "digital": 8.57,
        "physical": 8.7,
        "unit": "m",
        "difference": -0.13,
        "absVar": 1.494,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "3",
        "digital": 3.7,
        "physical": 3.6,
        "unit": "m",
        "difference": 0.1,
        "absVar": 2.778,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "4",
        "digital": 2.36,
        "physical": 2.4,
        "unit": "m",
        "difference": -0.04,
        "absVar": 1.667,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "5",
        "digital": 3.83,
        "physical": 3.9,
        "unit": "m",
        "difference": -0.07,
        "absVar": 1.795,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "1",
        "digital": 7.2,
        "physical": 7.3,
        "unit": "m",
        "difference": -0.1,
        "absVar": 1.37,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "2",
        "digital": 7.31,
        "physical": 7.3,
        "unit": "m",
        "difference": 0.01,
        "absVar": 0.137,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "3",
        "digital": 3.61,
        "physical": 3.5,
        "unit": "m",
        "difference": 0.11,
        "absVar": 3.143,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "4",
        "digital": 0.5,
        "physical": 0.6,
        "unit": "m",
        "difference": -0.1,
        "absVar": 16.667,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "5",
        "digital": 6.83,
        "physical": 6.7,
        "unit": "m",
        "difference": 0.13,
        "absVar": 1.94,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "6",
        "digital": 6.6,
        "physical": 6.7,
        "unit": "m",
        "difference": -0.1,
        "absVar": 1.493,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "7",
        "digital": 2.01,
        "physical": 2,
        "unit": "m",
        "difference": 0.01,
        "absVar": 0.5,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "8",
        "digital": 5.89,
        "physical": 6,
        "unit": "m",
        "difference": -0.11,
        "absVar": 1.833,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "1",
        "digital": 7.08,
        "physical": 7.1,
        "unit": "m",
        "difference": -0.02,
        "absVar": 0.282,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "2",
        "digital": 3.99,
        "physical": 4,
        "unit": "m",
        "difference": -0.01,
        "absVar": 0.25,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "3",
        "digital": 4.09,
        "physical": 4,
        "unit": "m",
        "difference": 0.09,
        "absVar": 2.25,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "4",
        "digital": 3.04,
        "physical": 3,
        "unit": "m",
        "difference": 0.04,
        "absVar": 1.333,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "5",
        "digital": 2.89,
        "physical": 3,
        "unit": "m",
        "difference": -0.11,
        "absVar": 3.667,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "1",
        "digital": 2.08,
        "physical": 2.15,
        "unit": "m",
        "difference": -0.07,
        "absVar": 3.256,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "2",
        "digital": 2.35,
        "physical": 2.15,
        "unit": "m",
        "difference": 0.2,
        "absVar": 9.302,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "3",
        "digital": 4.52,
        "physical": 4.5,
        "unit": "m",
        "difference": 0.02,
        "absVar": 0.444,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "4",
        "digital": 4.43,
        "physical": 4.5,
        "unit": "m",
        "difference": -0.07,
        "absVar": 1.556,
        "note": null
      }
    ],
    "note": null,
    "slug": "nz-03",
    "componentsChecked": 22,
    "within5": 20,
    "within10": 21,
    "timeSaved": 77.3
  },
  {
    "id": "NZ-04",
    "country": "New Zealand",
    "complexity": "simple",
    "feature": false,
    "digitalTime": "2:21",
    "siteTime": "8:47",
    "digitalPitch": 20,
    "sitePitch": 22.5,
    "area": {
      "digital": 165.69,
      "physical": 171,
      "variance": 3.105
    },
    "components": [
      {
        "type": "Ridge",
        "entry": "1",
        "digital": 8.83,
        "physical": 8.9,
        "unit": "m",
        "difference": -0.07,
        "absVar": 0.787,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "2",
        "digital": 5.99,
        "physical": 6,
        "unit": "m",
        "difference": -0.01,
        "absVar": 0.167,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "1",
        "digital": 7.11,
        "physical": 7,
        "unit": "m",
        "difference": 0.11,
        "absVar": 1.571,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "2",
        "digital": 3.72,
        "physical": 3.8,
        "unit": "m",
        "difference": -0.08,
        "absVar": 2.105,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "1",
        "digital": 4.06,
        "physical": 4,
        "unit": "m",
        "difference": 0.06,
        "absVar": 1.5,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "1",
        "digital": 3.09,
        "physical": 3,
        "unit": "m",
        "difference": 0.09,
        "absVar": 3,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "2",
        "digital": 2.78,
        "physical": 3,
        "unit": "m",
        "difference": -0.22,
        "absVar": 7.333,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "3",
        "digital": 5.18,
        "physical": 5.3,
        "unit": "m",
        "difference": -0.12,
        "absVar": 2.264,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "4",
        "digital": 5.46,
        "physical": 5.3,
        "unit": "m",
        "difference": 0.16,
        "absVar": 3.019,
        "note": null
      }
    ],
    "note": null,
    "slug": "nz-04",
    "componentsChecked": 9,
    "within5": 8,
    "within10": 9,
    "timeSaved": 73.2
  },
  {
    "id": "NZ-05",
    "country": "New Zealand",
    "complexity": "Medium/Complex",
    "feature": true,
    "digitalTime": "3:13",
    "siteTime": "12:42",
    "digitalPitch": 25,
    "sitePitch": 25,
    "area": {
      "digital": 311.33,
      "physical": 302.3,
      "variance": 2.987
    },
    "components": [
      {
        "type": "Ridge",
        "entry": "1",
        "digital": 4.16,
        "physical": 4.2,
        "unit": "m",
        "difference": -0.04,
        "absVar": 0.952,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "2",
        "digital": 9.39,
        "physical": 9.5,
        "unit": "m",
        "difference": -0.11,
        "absVar": 1.158,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "3",
        "digital": 3.1,
        "physical": 3.2,
        "unit": "m",
        "difference": -0.1,
        "absVar": 3.125,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "4",
        "digital": 3.3,
        "physical": 3.2,
        "unit": "m",
        "difference": 0.1,
        "absVar": 3.125,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "5",
        "digital": 1.15,
        "physical": 1.2,
        "unit": "m",
        "difference": -0.05,
        "absVar": 4.167,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "6",
        "digital": 4.25,
        "physical": 4.2,
        "unit": "m",
        "difference": 0.05,
        "absVar": 1.19,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "1",
        "digital": 5.13,
        "physical": 5.2,
        "unit": "m",
        "difference": -0.07,
        "absVar": 1.346,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "2",
        "digital": 5.29,
        "physical": 5.2,
        "unit": "m",
        "difference": 0.09,
        "absVar": 1.731,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "3",
        "digital": 1.26,
        "physical": 1.4,
        "unit": "m",
        "difference": -0.14,
        "absVar": 10,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "4",
        "digital": 3.85,
        "physical": 3.9,
        "unit": "m",
        "difference": -0.05,
        "absVar": 1.282,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "5",
        "digital": 3.99,
        "physical": 3.9,
        "unit": "m",
        "difference": 0.09,
        "absVar": 2.308,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "6",
        "digital": 7.42,
        "physical": 7.2,
        "unit": "m",
        "difference": 0.22,
        "absVar": 3.056,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "7",
        "digital": 7.08,
        "physical": 7.2,
        "unit": "m",
        "difference": -0.12,
        "absVar": 1.667,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "8",
        "digital": 1.99,
        "physical": 2.1,
        "unit": "m",
        "difference": -0.11,
        "absVar": 5.238,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "9",
        "digital": 5.09,
        "physical": 5,
        "unit": "m",
        "difference": 0.09,
        "absVar": 1.8,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "10",
        "digital": 5.06,
        "physical": 5,
        "unit": "m",
        "difference": 0.06,
        "absVar": 1.2,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "11",
        "digital": 6.67,
        "physical": 6.9,
        "unit": "m",
        "difference": -0.23,
        "absVar": 3.333,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "12",
        "digital": 7.22,
        "physical": 6.9,
        "unit": "m",
        "difference": 0.32,
        "absVar": 4.638,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "13",
        "digital": 2.22,
        "physical": 2.1,
        "unit": "m",
        "difference": 0.12,
        "absVar": 5.714,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "1",
        "digital": 4.23,
        "physical": 4.1,
        "unit": "m",
        "difference": 0.13,
        "absVar": 3.171,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "2",
        "digital": 7.44,
        "physical": 7.3,
        "unit": "m",
        "difference": 0.14,
        "absVar": 1.918,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "3",
        "digital": 7.1,
        "physical": 7.3,
        "unit": "m",
        "difference": -0.2,
        "absVar": 2.74,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "4",
        "digital": 5.39,
        "physical": 5.5,
        "unit": "m",
        "difference": -0.11,
        "absVar": 2,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "5",
        "digital": 5.56,
        "physical": 5.5,
        "unit": "m",
        "difference": 0.06,
        "absVar": 1.091,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "6",
        "digital": 4.96,
        "physical": 5,
        "unit": "m",
        "difference": -0.04,
        "absVar": 0.8,
        "note": null
      }
    ],
    "note": null,
    "slug": "nz-05",
    "componentsChecked": 25,
    "within5": 22,
    "within10": 25,
    "timeSaved": 74.7
  },
  {
    "id": "US-01",
    "country": "United States",
    "complexity": "Simple",
    "feature": false,
    "digitalTime": "2:24",
    "siteTime": "6:49",
    "digitalPitch": 15,
    "sitePitch": 14,
    "area": {
      "digital": 191.04,
      "physical": 196.2,
      "variance": 2.63
    },
    "components": [
      {
        "type": "Ridge",
        "entry": "1",
        "digital": 1.49,
        "physical": 1.5,
        "unit": "m",
        "difference": -0.01,
        "absVar": 0.667,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "2",
        "digital": 9.97,
        "physical": 10,
        "unit": "m",
        "difference": -0.03,
        "absVar": 0.3,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "1",
        "digital": 6.49,
        "physical": 6.3,
        "unit": "m",
        "difference": 0.19,
        "absVar": 3.016,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "2",
        "digital": 6.16,
        "physical": 6.3,
        "unit": "m",
        "difference": -0.14,
        "absVar": 2.222,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "3",
        "digital": 6.44,
        "physical": 6.5,
        "unit": "m",
        "difference": -0.06,
        "absVar": 0.923,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "4",
        "digital": 6.54,
        "physical": 6.5,
        "unit": "m",
        "difference": 0.04,
        "absVar": 0.615,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "5",
        "digital": 6.76,
        "physical": 6.8,
        "unit": "m",
        "difference": -0.04,
        "absVar": 0.588,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "1",
        "digital": 6.7,
        "physical": 6.6,
        "unit": "m",
        "difference": 0.1,
        "absVar": 1.515,
        "note": null
      }
    ],
    "note": null,
    "slug": "us-01",
    "componentsChecked": 8,
    "within5": 8,
    "within10": 8,
    "timeSaved": 64.8
  },
  {
    "id": "US-02",
    "country": "United States",
    "complexity": "Simple",
    "feature": false,
    "digitalTime": "2:34",
    "siteTime": "7:03",
    "digitalPitch": 23,
    "sitePitch": 20,
    "area": {
      "digital": 123.82,
      "physical": 118.4,
      "variance": 4.578
    },
    "components": [
      {
        "type": "Ridge",
        "entry": "1",
        "digital": 12.17,
        "physical": 12.1,
        "unit": "m",
        "difference": 0.07,
        "absVar": 0.579,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "2",
        "digital": 2.74,
        "physical": 2.8,
        "unit": "m",
        "difference": -0.06,
        "absVar": 2.143,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "1",
        "digital": 2.54,
        "physical": 2.3,
        "unit": "m",
        "difference": 0.24,
        "absVar": 10.435,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "2",
        "digital": 2.29,
        "physical": 2.3,
        "unit": "m",
        "difference": -0.01,
        "absVar": 0.435,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "1",
        "digital": 2.11,
        "physical": 2,
        "unit": "m",
        "difference": 0.11,
        "absVar": 5.5,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "2",
        "digital": 1.88,
        "physical": 2,
        "unit": "m",
        "difference": -0.12,
        "absVar": 6,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "3",
        "digital": 5,
        "physical": 5,
        "unit": "m",
        "difference": 0,
        "absVar": 0,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "4",
        "digital": 4.87,
        "physical": 5,
        "unit": "m",
        "difference": -0.13,
        "absVar": 2.6,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "5",
        "digital": 4.73,
        "physical": 5,
        "unit": "m",
        "difference": -0.27,
        "absVar": 5.4,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "6",
        "digital": 5.07,
        "physical": 5,
        "unit": "m",
        "difference": 0.07,
        "absVar": 1.4,
        "note": null
      }
    ],
    "note": null,
    "slug": "us-02",
    "componentsChecked": 10,
    "within5": 6,
    "within10": 9,
    "timeSaved": 63.6
  },
  {
    "id": "US-03",
    "country": "United States",
    "complexity": "Medium/Complex",
    "feature": true,
    "digitalTime": "2:56",
    "siteTime": "7:42",
    "digitalPitch": 18,
    "sitePitch": 20,
    "area": {
      "digital": 267.73,
      "physical": 272.9,
      "variance": 1.894
    },
    "components": [
      {
        "type": "Ridge",
        "entry": "1",
        "digital": 4.62,
        "physical": 4.7,
        "unit": "m",
        "difference": -0.08,
        "absVar": 1.702,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "2",
        "digital": 7.54,
        "physical": 7.6,
        "unit": "m",
        "difference": -0.06,
        "absVar": 0.789,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "3",
        "digital": 5.81,
        "physical": 5.8,
        "unit": "m",
        "difference": 0.01,
        "absVar": 0.172,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "4",
        "digital": 2.41,
        "physical": 2.5,
        "unit": "m",
        "difference": -0.09,
        "absVar": 3.6,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "1",
        "digital": 4.89,
        "physical": 5,
        "unit": "m",
        "difference": -0.11,
        "absVar": 2.2,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "2",
        "digital": 6.88,
        "physical": 6.9,
        "unit": "m",
        "difference": -0.02,
        "absVar": 0.29,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "3",
        "digital": 9.84,
        "physical": 10,
        "unit": "m",
        "difference": -0.16,
        "absVar": 1.6,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "4",
        "digital": 3.35,
        "physical": 3.4,
        "unit": "m",
        "difference": -0.05,
        "absVar": 1.471,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "1",
        "digital": 4.91,
        "physical": 5,
        "unit": "m",
        "difference": -0.09,
        "absVar": 1.8,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "2",
        "digital": 5.09,
        "physical": 5,
        "unit": "m",
        "difference": 0.09,
        "absVar": 1.8,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "3",
        "digital": 5.21,
        "physical": 5,
        "unit": "m",
        "difference": 0.21,
        "absVar": 4.2,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "1",
        "digital": 3.48,
        "physical": 3.5,
        "unit": "m",
        "difference": -0.02,
        "absVar": 0.571,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "2",
        "digital": 3.6,
        "physical": 3.5,
        "unit": "m",
        "difference": 0.1,
        "absVar": 2.857,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "3",
        "digital": 5.94,
        "physical": 6,
        "unit": "m",
        "difference": -0.06,
        "absVar": 1,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "4",
        "digital": 2.98,
        "physical": 3,
        "unit": "m",
        "difference": -0.02,
        "absVar": 0.667,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "5",
        "digital": 4.46,
        "physical": 4.3,
        "unit": "m",
        "difference": 0.16,
        "absVar": 3.721,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "6",
        "digital": 4.07,
        "physical": 4.3,
        "unit": "m",
        "difference": -0.23,
        "absVar": 5.349,
        "note": null
      }
    ],
    "note": null,
    "slug": "us-03",
    "componentsChecked": 17,
    "within5": 16,
    "within10": 17,
    "timeSaved": 61.9
  },
  {
    "id": "US-04",
    "country": "United States",
    "complexity": "Medium",
    "feature": false,
    "digitalTime": "2:41",
    "siteTime": "9:21",
    "digitalPitch": 18,
    "sitePitch": 20,
    "area": {
      "digital": 173.4,
      "physical": 168.8,
      "variance": 2.725
    },
    "components": [
      {
        "type": "Ridge",
        "entry": "1",
        "digital": 3.38,
        "physical": 3.5,
        "unit": "m",
        "difference": -0.12,
        "absVar": 3.429,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "2",
        "digital": 5.11,
        "physical": 5,
        "unit": "m",
        "difference": 0.11,
        "absVar": 2.2,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "1",
        "digital": 7.49,
        "physical": 7.5,
        "unit": "m",
        "difference": -0.01,
        "absVar": 0.133,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "2",
        "digital": 7.42,
        "physical": 7.5,
        "unit": "m",
        "difference": -0.08,
        "absVar": 1.067,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "3",
        "digital": 7.18,
        "physical": 7.5,
        "unit": "m",
        "difference": -0.32,
        "absVar": 4.267,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "4",
        "digital": 7.15,
        "physical": 7.5,
        "unit": "m",
        "difference": -0.35,
        "absVar": 4.667,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "1",
        "digital": 2.45,
        "physical": 2.3,
        "unit": "m",
        "difference": 0.15,
        "absVar": 6.522,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "2",
        "digital": 2.19,
        "physical": 2.3,
        "unit": "m",
        "difference": -0.11,
        "absVar": 4.783,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "1",
        "digital": 2.84,
        "physical": 3.1,
        "unit": "m",
        "difference": -0.26,
        "absVar": 8.387,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "2",
        "digital": 3.43,
        "physical": 3.1,
        "unit": "m",
        "difference": 0.33,
        "absVar": 10.645,
        "note": null
      }
    ],
    "note": null,
    "slug": "us-04",
    "componentsChecked": 10,
    "within5": 7,
    "within10": 9,
    "timeSaved": 71.3
  },
  {
    "id": "US-05",
    "country": "United States",
    "complexity": "Medium",
    "feature": false,
    "digitalTime": "2:58",
    "siteTime": "8:33",
    "digitalPitch": 19,
    "sitePitch": 20,
    "area": {
      "digital": 195.04,
      "physical": 202.2,
      "variance": 3.541
    },
    "components": [
      {
        "type": "Ridge",
        "entry": "1",
        "digital": 2.56,
        "physical": 2.6,
        "unit": "m",
        "difference": -0.04,
        "absVar": 1.538,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "2",
        "digital": 5.01,
        "physical": 5,
        "unit": "m",
        "difference": 0.01,
        "absVar": 0.2,
        "note": null
      },
      {
        "type": "Ridge",
        "entry": "3",
        "digital": 3.4,
        "physical": 3.5,
        "unit": "m",
        "difference": -0.1,
        "absVar": 2.857,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "1",
        "digital": 7.53,
        "physical": 7.5,
        "unit": "m",
        "difference": 0.03,
        "absVar": 0.4,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "2",
        "digital": 7.4,
        "physical": 7.5,
        "unit": "m",
        "difference": -0.1,
        "absVar": 1.333,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "3",
        "digital": 1.04,
        "physical": 1.1,
        "unit": "m",
        "difference": -0.06,
        "absVar": 5.455,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "4",
        "digital": 7.93,
        "physical": 7.4,
        "unit": "m",
        "difference": 0.53,
        "absVar": 7.162,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "5",
        "digital": 7.05,
        "physical": 7.4,
        "unit": "m",
        "difference": -0.35,
        "absVar": 4.73,
        "note": null
      },
      {
        "type": "Hip",
        "entry": "6",
        "digital": 1.51,
        "physical": 1.4,
        "unit": "m",
        "difference": 0.11,
        "absVar": 7.857,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "1",
        "digital": 5.23,
        "physical": 5.3,
        "unit": "m",
        "difference": -0.07,
        "absVar": 1.321,
        "note": null
      },
      {
        "type": "Valley",
        "entry": "2",
        "digital": 7.34,
        "physical": 7.2,
        "unit": "m",
        "difference": 0.14,
        "absVar": 1.944,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "1",
        "digital": 4.27,
        "physical": 4.2,
        "unit": "m",
        "difference": 0.07,
        "absVar": 1.667,
        "note": null
      },
      {
        "type": "Barge",
        "entry": "2",
        "digital": 4.03,
        "physical": 4.2,
        "unit": "m",
        "difference": -0.17,
        "absVar": 4.048,
        "note": null
      }
    ],
    "note": null,
    "slug": "us-05",
    "componentsChecked": 13,
    "within5": 10,
    "within10": 13,
    "timeSaved": 65.3
  }
];
