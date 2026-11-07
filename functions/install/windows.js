export async function onRequestGet(context) {
  // Redirect to the static Windows installer file or serve it
  const url = new URL(context.request.url);
  url.pathname = '/install/windows/lornAI-Installer.exe';
  return Response.redirect(url.toString(), 302);
}
