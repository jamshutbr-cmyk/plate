// PLATE 04.3.1 EXISTING SERVER BUILD.
// Uses the currently deployed generate / multi-roll / hw-roll contracts.
// NOT the new server anti-automation system. No automatic guarded-to-old fallback.
import {sb} from '../server.js';
export function existingRequest(name,body={}){
 if(name==='multi-roll')return {body:{n:body.n}};
 if(name==='generate'||name==='hw-roll')return {body:{}};
 throw new Error('Unsupported existing-server endpoint');
}
export async function guardedInvoke(name,body={}){
 // Same imported interface for the views. No UUID, permit, challenge,
 // automatic retry, fabricated result or additional server call.
 return sb.functions.invoke(name,existingRequest(name,body));
}
