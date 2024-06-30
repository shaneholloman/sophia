/**
 * This file defines the attributes used to describe telemetry in the context of LLM (Large Language Models) requests and responses.
 */

export const LLM_ATTRIBUTES = {
	// Input-related attributes
	'llm.prompt': 'The user prompt sent to the LLM',
	'llm.prompt.system': 'The system prompt sent to the LLM',
	'llm.prompt.chars': 'The total number of characters in the combined prompt',
	'llm.model': 'The identifier of the LLM model used',
	'llm.caller': 'The identifier of the caller (e.g., agent ID)',

	// Response-related attributes
	'llm.response': 'The text response generated by the LLM',
	'llm.response.chars': 'The number of characters in the LLM response',

	// Token-related attributes
	'llm.tokens.input': 'The number of input tokens',
	'llm.tokens.output': 'The number of output tokens',

	// Time-related attributes
	'llm.time.first_token': 'The time taken to receive the first token of the response',

	// Cost-related attributes
	'llm.cost.input': 'The cost associated with the input',
	'llm.cost.output': 'The cost associated with the output',
	'llm.cost.total': 'The total cost of the LLM operation',
};
