"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var openai_1 = require("openai");
var zod_1 = require("openai/helpers/zod");
var zod_2 = require("zod");
var sampleTranscripts_1 = require("./sampleTranscripts");
var conversationAnalysisSchema = zod_2.z.object({
    thoughts: zod_2.z.string(),
    feedback: zod_2.z.enum(['goofy', 'ok']),
    suggestion: zod_2.z.string(),
    messageTopic: zod_2.z.string(),
});
function analyzeTranscript(prevTranscript, newLine) {
    return __awaiter(this, void 0, void 0, function () {
        var openai, completion, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Analyzing transcript...");
                    openai = new openai_1.default({
                        apiKey: process.env.OPENAI_API_KEY || require('dotenv').config().parsed.OPENAI_API_KEY,
                    });
                    return [4 /*yield*/, openai.beta.chat.completions.parse({
                            model: 'gpt-4o-mini',
                            messages: [
                                {
                                    role: 'system',
                                    content: "Your user is on a date. They are speaker 0. Given the conversation history, and the current speech, your job is to think if the user is screwing up or not. ONLY JUDGE # Current Speech to Analyze\nFirst, reason about how the user is talking. Then, reason about how the user is screwing up.\nIf the user is being arrogant, embarrassing themselves, or being rude, then respond \"goofy\".\nIf the user is being honest and not rude, then respond \"ok\". If the other person is speaking, then respond \"ok\" and give the user a 5 word suggestion for what they should say next. Don't say the exact words, but a 5 word suggestion for the topic.\nAlso, use a 1-3 word phrase called topic to describe what specific line you're analyzing",
                                },
                                {
                                    role: 'user',
                                    content: "# Conversation History\n".concat(prevTranscript, "\n\n# Current Speech to Analyze\n").concat(newLine),
                                },
                            ],
                            response_format: (0, zod_1.zodResponseFormat)(conversationAnalysisSchema, 'analysis'),
                        })];
                case 1:
                    completion = _a.sent();
                    data = completion.choices[0].message.parsed;
                    return [2 /*return*/, data];
            }
        });
    });
}
function testAnalyzeTranscript(transcript) {
    return __awaiter(this, void 0, void 0, function () {
        var lines, history, i, currentLine, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Testing analyzeTranscript...");
                    console.log("Transcript: ", transcript);
                    lines = transcript.split('\n').filter(function (line) { return line.trim() !== ''; });
                    history = '';
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < lines.length)) return [3 /*break*/, 4];
                    currentLine = lines[i];
                    console.log("Analyzing line ".concat(i + 1, ": ").concat(currentLine));
                    return [4 /*yield*/, analyzeTranscript(history, currentLine)];
                case 2:
                    result = _a.sent();
                    console.log("Analysis result: ".concat(JSON.stringify(result, null, 2)));
                    history += currentLine + '\n';
                    _a.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Basic Transcript");
                    // await testAnalyzeTranscript(basicTranscript);   
                    console.log("----------------------------------------");
                    console.log("Random Transcript");
                    // await testAnalyzeTranscript(randomTranscript);
                    console.log("----------------------------------------");
                    console.log("Arrogant Transcript");
                    return [4 /*yield*/, testAnalyzeTranscript(sampleTranscripts_1.arrogantTranscript)];
                case 1:
                    _a.sent();
                    console.log("----------------------------------------");
                    console.log("Long Transcript");
                    // await testAnalyzeTranscript(longTranscript);
                    console.log("----------------------------------------");
                    console.log("Balanced Transcript");
                    return [4 /*yield*/, testAnalyzeTranscript(sampleTranscripts_1.balancedTranscript)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// main();
