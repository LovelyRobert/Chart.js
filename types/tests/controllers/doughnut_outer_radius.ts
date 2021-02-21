import { Chart } from '../../index.esm';

const chart = new Chart('id', {
  type: 'doughnut',
  data: {
    labels: [],
    datasets: [{
      data: [],
    }]
  },
  options: {
    outerRadius: () => Math.random() > 0.5 ? 50 : '50%',
  }
});
