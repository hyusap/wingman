import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import dotenv from 'dotenv';
import { basicTranscript, randomTranscript, arrogantTranscript, longTranscript, balancedTranscript } from './sampleTranscripts';

const conversationAnalysisSchema = z.object({    
    thoughts: z.string(),
    feedback: z.enum(['goofy', 'ok']),    
    suggestion: z.string(),    
    messageTopic: z.string(),
});





async function analyzeTranscript(prevTranscript: string, newLine: string): Promise<z.infer<typeof conversationAnalysisSchema> | null> {
    console.log("Analyzing transcript...");
    
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || require('dotenv').config().parsed.OPENAI_API_KEY,
    });

    const completion = await openai.beta.chat.completions.parse({
		model: 'gpt-4o-mini',
		messages: [
			{
				role: 'system',
				content: `Your user is on a date. They are speaker 0. Given the conversation history, and the current speech, your job is to think if the user is screwing up or not. ONLY JUDGE # Current Speech to Analyze
First, reason about how the user is talking. Then, reason about how the user is screwing up.
If the user is being arrogant, embarrassing themselves, or being rude, then respond "goofy".
If the user is being honest and not rude, then respond "ok". If the other person is speaking, then respond "ok" and give the user a 5 word suggestion for what they should say next. Don't say the exact words, but a 5 word suggestion for the topic.
Also, use a 1-3 word phrase called topic to describe what specific line you're analyzing`
,
			},
			{
				role: 'user',
				content: `# Conversation History
${prevTranscript}

# Current Speech to Analyze
${newLine}`,
			},
		],
		response_format: zodResponseFormat(conversationAnalysisSchema, 'analysis'),
	});

	const data = completion.choices[0].message.parsed;
    return data;
}


async function testAnalyzeTranscript(transcript: string): Promise<void> {
    console.log("Testing analyzeTranscript...");
    console.log("Transcript: ", transcript);
    const lines = transcript.split('\n').filter(line => line.trim() !== '');
    let history = '';

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];
        console.log(`Analyzing line ${i + 1}: ${currentLine}`);
        
        const result = await analyzeTranscript(history, currentLine);
        console.log(`Analysis result: ${JSON.stringify(result, null, 2)}`);

        history += currentLine + '\n';
    }
    
}

async function main(): Promise<void> {
    console.log("Basic Transcript");
    // await testAnalyzeTranscript(basicTranscript);   
    console.log("----------------------------------------");
    console.log("Random Transcript");
    // await testAnalyzeTranscript(randomTranscript);
    console.log("----------------------------------------");
    console.log("Arrogant Transcript");
    await testAnalyzeTranscript(arrogantTranscript);
    console.log("----------------------------------------");
    console.log("Long Transcript");
    // await testAnalyzeTranscript(longTranscript);
    console.log("----------------------------------------");
    console.log("Balanced Transcript");
    await testAnalyzeTranscript(balancedTranscript);
}

// main();

