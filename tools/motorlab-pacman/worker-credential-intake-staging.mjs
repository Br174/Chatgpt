// Secure credential intake boundary. No host-backed secret transport is available yet.
// This endpoint deliberately never reads, logs, stores or forwards request bodies.
const reply=(error,status)=>Response.json({error},{status,headers:{"Cache-Control":"no-store","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});
export default {
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path!=="/credentials/intake")return reply("NOT_FOUND",404);
  if(request.method!=="POST")return reply("METHOD_NOT_ALLOWED",405);
  // Fail before request.text()/json(): secrets must not cross an untrusted chat channel.
  return reply("TRUSTED_SECRET_ENTRY_HOST_NOT_CONNECTED",503);
 }
};
