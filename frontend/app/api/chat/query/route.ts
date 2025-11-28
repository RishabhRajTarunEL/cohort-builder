import { NextRequest, NextResponse } from 'next/server';
import { parseAgentOutput } from '@/app/lib/mockData';

// This is a mock agent output based on the agent output.txt file
// In production, this would call your actual NLQ agent
const mockAgentResponse = {
  criteria: [
    {
      type: 'include',
      text: 'are female',
      entities: ['female'],
      db_mappings: {
        female: {
          entity_class: 'Demographic',
          'table.field': 'patient.gender',
          ranked_matches: [
            'patient.gender',
            'patient.self_reported_race',
            'patient.self_reported_ethnicity',
          ],
          mapped_concept: 'Female',
          mapping_method: 'LLM_decision',
          reason: "The entity 'female' directly matches the candidate 'Female'.",
          top_candidates: ['Female', 'Male'],
        },
      },
      revised_criterion: "patient.gender = 'Female'",
      validation_results: [
        {
          expression: "patient.gender = 'Female'",
          validation: {
            valid: true,
            reason:
              "The filtering value 'Female' is compatible with the column's string format as it matches one of the defined categorical values in the 'gender' column.",
          },
        },
      ],
    },
    {
      type: 'include',
      text: 'are asian',
      entities: ['asian'],
      db_mappings: {
        asian: {
          entity_class: 'Population Group',
          'table.field': 'patient.self_reported_race',
          ranked_matches: [
            'patient.self_reported_race',
            'patient.self_reported_ethnicity',
            'patient.gender',
          ],
          mapped_concept: 'Asian',
          mapping_method: 'LLM_decision',
          reason: "The entity 'asian' directly matches the candidate 'Asian'.",
          top_candidates: ['Asian', 'White', 'Black', 'PacificIslander', 'Multiracial'],
        },
      },
      revised_criterion: "patient.self_reported_race = 'Asian'",
      validation_results: [
        {
          expression: "patient.self_reported_race = 'Asian'",
          validation: {
            valid: true,
            reason:
              "The filtering value 'Asian' is compatible with the column's string format as it matches one of the possible values in the 'self_reported_race' column.",
          },
        },
      ],
    },
    {
      type: 'include',
      text: 'have breast cancer',
      entities: ['breast cancer'],
      db_mappings: {
        'breast cancer': {
          entity_class: 'Disease',
          'table.field': 'patient.prior_malignancy',
          ranked_matches: [
            'patient.prior_malignancy',
            'sample.dx_at_inclusion',
            'sample.specific_dx_at_inclusion',
          ],
          mapped_concept: 'Breast Cancer',
          mapping_method: 'semantic_search',
          reason: null,
          top_candidates: [
            'Breast Cancer',
            'Anal carcinoma|Breast Cancer',
            'Uterine Sarcoma|Breast Cancer',
            'Ovarian cancer',
            'Bladder Cancer|Ovarian cancer',
          ],
        },
      },
      revised_criterion: "patient.prior_malignancy = 'Breast Cancer'",
      validation_results: [
        {
          expression: "patient.prior_malignancy = 'Breast Cancer'",
          validation: {
            valid: true,
            reason:
              "The filtering value 'Breast Cancer' is compatible with the column's string format as it matches the general pattern of cancer types described in the column summary.",
          },
        },
      ],
    },
    {
      type: 'include',
      text: 'have frameshift mutation',
      entities: ['frameshift mutation'],
      db_mappings: {
        'frameshift mutation': {
          entity_class: 'Genetic Mutation',
          'table.field': 'mutation.variant_classification',
          ranked_matches: [
            'mutation.variant_classification',
            'mutation.existing_variation',
            'mutation.biotype',
          ],
          mapped_concept: 'frameshift_variant',
          mapping_method: 'LLM_decision',
          reason:
            "The entity 'frameshift mutation' directly corresponds to the concept 'frameshift_variant'.",
          top_candidates: [
            'frameshift_variant',
            'missense_variant',
            'stop_gained',
            'inframe_deletion',
            'splice_acceptor_variant',
          ],
        },
      },
      revised_criterion: "mutation.variant_classification = 'frameshift_variant'",
      validation_results: [
        {
          expression: "mutation.variant_classification = 'frameshift_variant'",
          validation: {
            valid: true,
            reason:
              "The filtering value 'frameshift_variant' is a string and matches the expected text data type of the column, which contains similar string classifications.",
          },
        },
      ],
    },
  ],
  sql_query:
    "SELECT patient.patient_id FROM patient JOIN sample ON patient.patient_id = sample.patient_id JOIN mutation ON sample.sample_id = mutation.sample_id WHERE patient.gender = 'Female' AND patient.self_reported_race = 'Asian' AND patient.prior_malignancy = 'Breast Cancer' AND mutation.variant_classification = 'frameshift_variant'",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userMessage = body.message;

    // In production, you would call your NLQ agent here
    // For now, we're using the mock response
    // const agentResponse = await callYourNLQAgent(userMessage);

    // Parse the agent output to create Filter objects
    const suggestedFilters = parseAgentOutput(mockAgentResponse);

    return NextResponse.json({
      query_id: `query-${Date.now()}`,
      interpretation: `I found ${suggestedFilters.length} filters based on your query: "${userMessage}"`,
      suggested_filters: suggestedFilters,
      requires_clarification: false,
    });
  } catch (error) {
    console.error('Error processing query:', error);
    return NextResponse.json(
      { error: 'Failed to process query' },
      { status: 500 }
    );
  }
}
