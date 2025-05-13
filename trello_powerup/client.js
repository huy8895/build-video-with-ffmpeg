window.TrelloPowerUp.initialize({
  'card-buttons': function (t, options) {
    return [{
      icon: './icon.png',
      text: '🎞 Build video',
      callback: function (t) {
        return t.popup({
          title: "Build video",
          url: "popup/popup.html", 
          height: 200
        });
      }
    }];
  },
  'card-badges': function (t, options) {
    return t.get('card', 'shared', 'flow')
      .then(function (flow) {
        return [{
          text: flow,
          color: 'blue', // hoặc 'green', 'red', 'purple', 'sky', 'orange'
          icon: 'https://cdn-icons-png.flaticon.com/512/25/25231.png'
        }];
      });
  },

  'card-detail-badges': function (t, options) {
    return t.get('card', 'shared')
      .then(function (data) {
        if (!data || !data.flow) return [];

        return [{
          title: 'Build Status',
          text: data.flow,
          callback: function (t) {
            return t.popup({
              title: 'Build Progress',
              url: 'popup/popup.html', // hoặc popup khác nếu bạn có
              height: 200
            });
          }
        }];
      });
  },
});
