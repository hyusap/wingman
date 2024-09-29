import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

// CREATE TABLE transcript_segments (
//     id SERIAL PRIMARY KEY,
//     session_id VARCHAR(255) NOT NULL,
//     uid VARCHAR(255) NOT NULL,
//     text TEXT NOT NULL,
//     speaker VARCHAR(255) NOT NULL,
//     speaker_id INTEGER NOT NULL,
//     is_user BOOLEAN NOT NULL,
//     start_time FLOAT NOT NULL
// );

interface TranscriptSegment {
	text: string;
	speaker: string;
	speakerId: number;
	is_user: boolean;
	start: number;
	end: number;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		console.log('Fetching transcript...');
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		const url = new URL(request.url);
		const uid = url.searchParams.get('uid');
		let sessionId: string | undefined;

		console.log(url);

		let data;
		let segments;
		try {
			data = (await request.json()) as { session_id: string; segments: TranscriptSegment[] };
			sessionId = data.session_id;
			segments = data.segments;
		} catch (error) {
			console.error('Error parsing request body:', error);
			return new Response('Invalid request body', { status: 400 });
		}

		if (!sessionId || !uid) {
			return new Response('Missing session_id or uid', { status: 400 });
		}

		const conversationHistory = await fetchAndStore(env.DB, segments, sessionId, uid);

		const status = await analyzeTranscript(conversationHistory, segments, env.OPENAI_API_KEY);

		let message: string;
		switch (status) {
			case 'yapping':
				message = "You're talking too much!";
				break;
			case 'goofy':
				message = 'WTF are you talking about?';
				break;
			case 'ok':
				return new Response('', { status: 200 });
				break;
		}

		// Process the segments here
		// For now, we'll just return the received data
		return new Response(
			JSON.stringify({
				message,
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
				},
			}
		);
	},
} satisfies ExportedHandler<Env>;

async function fetchAndStore(DB: D1Database, newSegments: TranscriptSegment[], sessionId: string, uid: string) {
	const { results } = await DB.prepare(
		`SELECT * FROM transcript_segments 
		WHERE session_id = ? AND uid = ? 
		ORDER BY start_time ASC`
	)
		.bind(sessionId, uid)
		.all();

	const conversationHistory = results as unknown as TranscriptSegment[];

	for (const segment of newSegments) {
		if (segment.is_user == undefined) {
			segment.is_user = false;
			console.log('segment.is_user is undefined, setting it to false');
		}

		if (segment.speakerId == undefined) {
			segment.speakerId = 0;
			console.log('segment.speakerId is undefined, setting it to 0');
		}
		// Note: segment.is_user is already checked and set to false if undefined
		await DB.prepare(
			`INSERT INTO transcript_segments 
			(session_id, uid, text, speaker, speaker_id, is_user, start_time) 
			VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
			.bind(sessionId, uid, segment.text, segment.speaker, segment.speakerId, segment.is_user ? 1 : 0, segment.start)
			.run();
	}

	return conversationHistory;
}

const AIAnalysis = z.object({
	thoughts: z.string(),
	feedback: z.enum(['yapping', 'goofy', 'ok']),
});

function transcriptToText(segments: TranscriptSegment[]) {
	return segments.map((segment) => `${segment.is_user ? 'Main User' : segment.speaker}: ${segment.text}`).join('\n');
}

async function analyzeTranscript(history: TranscriptSegment[], currentSegments: TranscriptSegment[], apiKey: string) {
	const openai = new OpenAI({
		apiKey,
	});

	const completion = await openai.beta.chat.completions.parse({
		model: 'gpt-4o-2024-08-06',
		messages: [
			{
				role: 'system',
				content: `Your user is on a date. Given the conversation history, and the current speech, your job is to think if the user is screwing up or not.
First, reason about how the user is talking. Then, reason about how the user is screwing up.

If the user has been talking for too long without letting the other person speak, then respond "yapping".
If the user is being stupid, embarrassing themselves, or rude, then respond "goofy".
If the user is being honest and not rude, then respond "ok".`,
			},
			{
				role: 'user',
				content: `# Conversation History
${transcriptToText(history)}

# Current Speech to Analyze
${transcriptToText(currentSegments)}`,
			},
		],
		response_format: zodResponseFormat(AIAnalysis, 'analysis'),
	});

	const data = completion.choices[0].message.parsed;

	console.log(data?.thoughts);

	return data?.feedback ?? 'ok';
}
