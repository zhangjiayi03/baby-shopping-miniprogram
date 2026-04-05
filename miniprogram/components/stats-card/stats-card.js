// components/stats-card/stats-card.js
Component({
  properties: {
    todaySpent: {
      type: Number,
      value: 0
    },
    yesterdaySpent: {
      type: Number,
      value: 0
    },
    orderCount: {
      type: Number,
      value: 0
    }
  },

  data: {
    changePercent: 0,
    changeIcon: '↑',
    changeClass: 'increase'
  },

  observers: {
    'todaySpent,yesterdaySpent': function(today, yesterday) {
      this.updateComparison(today, yesterday);
    }
  },

  methods: {
    updateComparison(today, yesterday) {
      let changePercent = 0;
      let changeIcon = '→';
      let changeClass = '';

      if (yesterday > 0) {
        changePercent = Math.round(((today - yesterday) / yesterday) * 100);
        if (changePercent > 0) {
          changeIcon = '↑';
          changeClass = 'increase';
        } else if (changePercent < 0) {
          changeIcon = '↓';
          changeClass = 'decrease';
          changePercent = Math.abs(changePercent);
        }
      }

      this.setData({
        changePercent: changePercent,
        changeIcon: changeIcon,
        changeClass: changeClass
      });
    }
  }
});
