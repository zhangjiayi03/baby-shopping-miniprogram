// components/budget-card/budget-card.js
Component({
  properties: {
    budget: {
      type: Number,
      value: 2000
    },
    spent: {
      type: Number,
      value: 0
    }
  },

  data: {
    remaining: 0,
    percentage: 0,
    progressWidth: 0,
    percentageColor: '#4ade80'
  },

  observers: {
    'budget,spent': function(budget, spent) {
      this.updateBudgetData(budget, spent);
    }
  },

  methods: {
    updateBudgetData(budget, spent) {
      const remaining = parseFloat((budget - spent).toFixed(2));
      const percentage = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      
      let color = '#4ade80';
      if (percentage > 80) {
        color = '#fbbf24';
      }
      if (percentage > 100) {
        color = '#ef4444';
      }

      this.setData({
        remaining: remaining,
        percentage: percentage,
        progressWidth: Math.min(percentage, 100),
        percentageColor: color
      });
    }
  }
});
