import { Anthropic as AnthropicSdk } from '@anthropic-ai/sdk';
import { AgentLLMs, addCost, agentContext } from '#agent/agentContext';
import { envVar } from '#utils/env-var';
import { BaseLLM } from '../base-llm';
import { MaxTokensError } from '../errors';
import { LLM, combinePrompts, logTextGeneration } from '../llm';
import { MultiLLM } from '../multi-llm';
import Message = AnthropicSdk.Message;
import { CallerId } from '#llm/llmCallService/llmCallService';
import { CreateLlmResponse } from '#llm/llmCallService/llmRequestResponse';
import { logger } from '#o11y/logger';
import { withActiveSpan } from '#o11y/trace';
import { currentUser } from '#user/userService/userContext';
import { appContext } from '../../app';
import { RetryableError } from '../../cache/cacheRetry';

export const ANTHROPIC_SERVICE = 'anthropic';

export function anthropicLLMRegistry(): Record<string, () => LLM> {
	return {
		[`${ANTHROPIC_SERVICE}:claude-3-haiku`]: Claude3_Haiku,
		[`${ANTHROPIC_SERVICE}:claude-3-sonnet`]: Claude3_Sonnet,
		[`${ANTHROPIC_SERVICE}:claude-3-opus`]: Claude3_Opus,
	};
}

// https://docs.anthropic.com/en/docs/glossary#tokens
// For Claude, a token approximately represents 3.5 English characters
export function Claude3_Opus() {
	return new Anthropic('claude-3-opus-20240229', 15 / (1_000_000 * 3.5), 75 / (1_000_000 * 3.5));
}

export function Claude3_Sonnet() {
	return new Anthropic('claude-3-sonnet-20240229', 3 / (1_000_000 * 3.5), 15 / (1_000_000 * 3.5));
}

export function Claude3_Haiku() {
	return new Anthropic('claude-3-haiku-20240307', 0.25 / (1_000_000 * 3.5), 1.25 / (1_000_000 * 3.5));
}

export function anthropicLLmFromModel(model: string): LLM | null {
	if (model.startsWith('claude-3-sonnet-')) return Claude3_Sonnet();
	if (model.startsWith('claude-3-haiku-')) return Claude3_Haiku();
	if (model.startsWith('claude-3-opus-')) return Claude3_Opus();
	return null;
}

export function ClaudeLLMs(): AgentLLMs {
	const opus = Claude3_Opus();
	return {
		easy: Claude3_Haiku(),
		medium: Claude3_Sonnet(),
		hard: opus,
		xhard: new MultiLLM([opus], 5),
	};
}

export class Anthropic extends BaseLLM {
	anthropic: AnthropicSdk;
	constructor(model: string, inputCostPerChar = 0, outputCostPerChar = 0) {
		super(ANTHROPIC_SERVICE, model, 200_000, inputCostPerChar, outputCostPerChar);
		this.anthropic = new AnthropicSdk({ apiKey: currentUser().llmConfig.anthropicKey ?? envVar('ANTHROPIC_API_KEY') });
	}

	@logTextGeneration
	async generateText(userPrompt: string, systemPrompt?: string): Promise<string> {
		return withActiveSpan('generateText', async (span) => {
			const prompt = combinePrompts(userPrompt, systemPrompt);

			if (systemPrompt) span.setAttribute('systemPrompt', systemPrompt);
			span.setAttributes({
				userPrompt,
				inputChars: prompt.length,
				model: this.model,
			});

			const caller: CallerId = { agentId: agentContext().agentId };
			const llmRequestSave = appContext().llmCallService.saveRequest(userPrompt, systemPrompt);
			const requestTime = Date.now();

			let message: Message;
			try {
				message = await this.anthropic.messages.create({
					max_tokens: 4096,
					system: systemPrompt,
					messages: [{ role: 'user', content: prompt }],
					model: this.model,
					stop_sequences: ['</response>'], // This is needed otherwise it can hallucinate the function response and continue on
				});
			} catch (e) {
				if (e.status === 529 || e.status === 429) {
					throw new RetryableError(e);
				}
				logger.error(e);
				logger.error(Object.keys(e));
				throw e;
			}

			// TODO handle if there is a type != text
			const responseText = message.content.map((content) => content.text).join();

			const timeToFirstToken = Date.now();
			const finishTime = Date.now();

			const llmRequest = await llmRequestSave;
			const llmResponse: CreateLlmResponse = {
				llmId: this.getId(),
				llmRequestId: llmRequest.id,
				responseText: responseText,
				requestTime,
				timeToFirstToken: timeToFirstToken,
				totalTime: finishTime - requestTime,
			};
			await appContext().llmCallService.saveResponse(llmRequest.id, caller, llmResponse);

			const inputTokens = message.usage.input_tokens;
			const outputTokens = message.usage.output_tokens;
			const stopReason = message.stop_reason;

			const inputCost = this.getInputCostPerToken() * inputTokens;
			const outputCost = this.getOutputCostPerToken() * outputTokens;
			const cost = inputCost + outputCost;

			span.setAttributes({
				inputTokens,
				outputTokens,
				response: responseText,
				timeToFirstToken,
				inputCost,
				outputCost,
				cost,
				outputChars: responseText.length,
			});

			addCost(cost);

			if (stopReason === 'max_tokens') {
				throw new MaxTokensError(this.getMaxInputTokens(), responseText);
			}

			return responseText;
		});
	}
}

// error: {
// 	type: 'error',
// 		error: {
// 		type: 'invalid_request_error',
// 			message: 'Your credit balance is too low to access the Claude API. Please go to Plans & Billing to upgrade or purchase credits.'
// 	}
// }