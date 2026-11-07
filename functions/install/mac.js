export async function onRequestGet(context) {
  // Redirect to the static macOS zip package or serve it
  const url = new URL(context.request.url);
  url.pathname = '/install/mac/lornAI-Installer-mac.zip';
  return Response.redirect(url.toString(), 302);
}
