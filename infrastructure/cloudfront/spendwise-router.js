function handler(event) {
  var request = event.request;
  if (request.headers.host.value === 'spendwise.abdullahiomer.com') {
    var uri = request.uri;
    if (uri === '/spendwise' || uri === '/spendwise/') {
      request.uri = '/spendwise/index.html';
    } else if (uri.indexOf('/spendwise/') !== 0) {
      request.uri = '/spendwise' + uri;
    }
    if (request.uri.endsWith('/')) request.uri += 'index.html';
  }
  return request;
}
