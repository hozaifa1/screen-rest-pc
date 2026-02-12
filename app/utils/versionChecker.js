class VersionChecker {
  latest () {
    return fetch(
      'https://api.github.com/repos/hozaifa1/stretchly/releases/latest',
      {
        method: 'GET',
        headers: { 'User-Agent': 'hozaifa1/stretchly' },
        mode: 'cors',
        cache: 'default'
      })
      .then(response => response.text())
      .then(body => JSON.parse(body).tag_name)
      .catch(() => {})
  }
}

export default VersionChecker
