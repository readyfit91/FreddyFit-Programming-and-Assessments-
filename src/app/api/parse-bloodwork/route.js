import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PANEL_MARKERS = {
  'CBC with Differential': [
    'WBC','Neutrophils','Lymphocytes','Monocytes','Eosinophils','Basophils',
    'RBC','Hemoglobin','Hematocrit','MCV','MCH','MCHC','Platelets'
  ],
  'Lipid Panel': [
    'Total Cholesterol','LDL','HDL','Triglycerides','Non-HDL Cholesterol','LDL/HDL Ratio'
  ],
  'Comprehensive Metabolic Panel': [
    'Glucose','BUN','Creatinine','eGFR','BUN/Creatinine Ratio','Sodium','Potassium',
    'Chloride','CO2','Calcium','Total Protein','Albumin','Globulin','A/G Ratio',
    'Total Bilirubin','ALT','AST','Alkaline Phosphatase'
  ],
  'Hemoglobin A1C': [
    'HbA1c','Fasting Glucose','Fasting Insulin','HOMA-IR'
  ],
  'Other / Additional': [
    'Testosterone','Free Testosterone','SHBG','DHEA-S','Estradiol','Cortisol',
    'TSH','Free T3','Free T4','Vitamin D','B12','Folate','Iron','TIBC','Ferritin',
    'CRP','Homocysteine','Uric Acid','Omega-3 Index','Magnesium','Zinc',
    'LDH','PSA','GGT','Fibrinogen','Apolipoprotein B','Lp(a)'
  ]
}

const ALL_MARKERS = Object.values(PANEL_MARKERS).flat()

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('pdf')
    const panelName = formData.get('panel') || null
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length === 0) {
      return Response.json({ error: 'Empty file received' }, { status: 400 })
    }

    const base64 = buffer.toString('base64')
    const markerList = panelName && PANEL_MARKERS[panelName]
      ? PANEL_MARKERS[panelName]
      : ALL_MARKERS

    const panelContext = panelName
      ? `This is a ${panelName} lab report. Focus only on extracting these specific markers.`
      : 'This may contain any blood work markers.'

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            }
          },
          {
            type: 'text',
            text: `You are a medical lab result parser. ${panelContext}

Extract values from this lab report PDF and return ONLY a valid JSON object.

Use exactly these marker names (match by common lab abbreviations and synonyms):
${markerList.join(', ')}

Rules:
- Only include markers that appear in the report with a clear numeric result
- Use the exact marker name from the list above (not the lab's abbreviation)
- Values must be numeric only — no units, flags, or reference ranges
- If a marker appears multiple times, use the most recent result value
- Return ONLY the JSON object, no explanation or markdown

Example output format: {"WBC": 6.2, "Hemoglobin": 14.1}`
          }
        ]
      }]
    })

    const text = response.content?.map(b => b.text || '').join('') || ''
    let markers = {}
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) markers = JSON.parse(match[0])
    } catch {
      return Response.json({ error: 'Could not parse AI response' }, { status: 500 })
    }

    const count = Object.keys(markers).length
    return Response.json({ markers, count, panel: panelName })
  } catch (error) {
    console.error('parse-bloodwork error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
