import React, { Component } from 'react';
import * as d3 from 'd3';
//import Papa from 'papaparse';
import './App.css';
import heart_data from './heart_data.csv';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      filteredData: [],
      sliderValue: 0,
      minAge: 0,
      maxAge: 100,
      numPoints: 1000,
      pendingNumPoints: 1000,
      heatmapData: [],
      heatmapFilter: 'all',
    };
    this.svgRef = React.createRef();
    this.tooltipRef = React.createRef();
    this.heatmapRef = React.createRef();
  }

  componentDidMount() {
    d3.csv(heart_data, row => {
      const ageInYearsFloat = parseFloat((+row.age / 365).toFixed(2));
      const ageInYearsInt = Math.floor(ageInYearsFloat);
      const heightInMeters = +row.height / 100;
      const bmi = +row.weight / (heightInMeters * heightInMeters);
      return {
        index: +row.index,
        id: +row.id,
        age_days: +row.age,
        age_years: ageInYearsInt,
        age_years_float: ageInYearsFloat,
        gender: +row.gender,
        height: +row.height,
        weight_kg: +row.weight,
        weight_lb: +(row.weight * 2.20462).toFixed(2),
        ap_hi: +row.ap_hi,
        ap_lo: +row.ap_lo,
        cholesterol: +row.cholesterol,
        glucose: +row.gluc,
        smoke: +row.smoke,
        alcohol: +row.alco,
        active: +row.active,
        cardio: +row.cardio,
        bmi: bmi.toFixed(2),
      };
    }).then(allData => {
      const ages = allData.map(d => d.age_years);
      const minAge = d3.min(ages);
      const maxAge = d3.max(ages);
      this.setState({
        data: allData,
        filteredData: allData.slice(0, 1000),
        sliderValue: maxAge,
        minAge,
        maxAge,
        numPoints: 1000,
        heatmapData: allData,
      }, () => {
        this.initializeChart();
        this.filterData();
        this.updateChart();
        this.updateXAxis();
        this.drawHeatmap();
      });
    });
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.sliderValue !== this.state.sliderValue && this.xScale) {
      this.filterData();
      this.updateChart();
      this.updateXAxis();
    }
    if (prevState.heatmapFilter !== this.state.heatmapFilter) {
      this.drawHeatmap();
    }
  }

  filterData = () => {
    const { data, sliderValue, numPoints } = this.state;
    const filteredData = data.filter(d => d.age_years_float <= sliderValue).slice(0, numPoints);
    this.setState({ filteredData });
  };

  initializeChart = () => {
    const svg = d3.select(this.svgRef.current).attr('width', 800).attr('height', 600);
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    this.width = width;
    this.height = height;
    this.margin = margin;

    this.chart = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    this.xScale = d3.scaleLinear().domain([this.state.minAge, this.state.maxAge]).range([0, width]);

    const weights = this.state.data.map(d => d.weight_lb);
    this.yScale = d3.scaleLinear().domain([d3.min(weights) - 5, d3.max(weights) + 5]).range([height, 0]);

    this.xAxisGroup = this.chart.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(this.xScale));
    this.yAxisGroup = this.chart.append('g').call(d3.axisLeft(this.yScale));

    this.chart.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -50)
      .attr('x', -height / 2)
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .text('Weight (lbs)');
  };

  updateXAxis = () => {
    const { sliderValue, minAge } = this.state;
    this.xScale.domain([minAge, sliderValue]);
    this.xAxisGroup.transition().duration(500).call(d3.axisBottom(this.xScale));
  };

  updateChart = () => {
    const svg = d3.select(this.svgRef.current);
    const chartGroup = svg.select('g');
    const { filteredData } = this.state;

    const ages = filteredData.map(d => d.age_years_float);
    const weights = filteredData.map(d => d.weight_lb);
    this.xScale.domain([d3.min(ages), d3.max(ages)]);
    this.yScale.domain([d3.min(weights) - 5, d3.max(weights) + 5]);

    this.xAxisGroup.transition().duration(500).call(d3.axisBottom(this.xScale));
    this.yAxisGroup.transition().duration(500).call(d3.axisLeft(this.yScale));

    const circles = chartGroup.selectAll('circle').data(filteredData);
    circles.exit().remove();
    circles.transition().duration(500)
      .attr('cx', d => this.xScale(d.age_years_float))
      .attr('cy', d => this.yScale(d.weight_lb));
    circles.enter().append('circle')
      .attr('cx', d => this.xScale(d.age_years_float))
      .attr('cy', d => this.yScale(d.weight_lb))
      .attr('r', d => d.cardio === 1 ? 4 : 3)
      .attr('fill', d => d.cardio === 1 ? 'red' : 'steelblue')
      .on('mouseover', this.handleMouseOver)
      .on('mouseout', this.handleMouseOut);
  };

  handleMouseOver = (event, d) => {
    const tooltip = d3.select(this.tooltipRef.current);
    tooltip.style('visibility', 'visible')
      .html(`ID: ${d.id}<br/>Age: ${d.age_years}<br/>Weight: ${d.weight_lb} lbs<br/>Cardio: ${d.cardio}`)
      .style('left', `${event.pageX + 5}px`)
      .style('top', `${event.pageY - 28}px`);
  };

  handleMouseOut = () => {
    d3.select(this.tooltipRef.current).style('visibility', 'hidden');
  };

  computeCorrelation = (x, y) => {
    const avgX = d3.mean(x);
    const avgY = d3.mean(y);
    const numerator = d3.sum(x.map((xi, i) => (xi - avgX) * (y[i] - avgY)));
    const denominatorX = Math.sqrt(d3.sum(x.map(xi => (xi - avgX) ** 2)));
    const denominatorY = Math.sqrt(d3.sum(y.map(yi => (yi - avgY) ** 2)));
    return denominatorX && denominatorY ? numerator / (denominatorX * denominatorY) : 0;
  };

  drawHeatmap = () => {
    const { heatmapData, heatmapFilter } = this.state;
    const tooltip = d3.select('body').selectAll('.tooltip').data([0]).join('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('background-color', 'white')
      .style('position', 'absolute')
      .style('border', '1px solid gray');

    const filtered = heatmapFilter === 'all'
      ? heatmapData
      : heatmapData.filter(d => d.cardio === (heatmapFilter === 'cardio_1' ? 1 : 0));

    const metrics = ["age", "height", "weight_kg", "ap_hi", "ap_lo", "cholesterol", "glucose", "cardio"];
    const data = [];

    metrics.forEach(v1 => {
      metrics.forEach(v2 => {
        data.push({
          variable1: v1,
          variable2: v2,
          correlation: this.computeCorrelation(filtered.map(d => d[v1]), filtered.map(d => d[v2]))
        });
      });
    });

    const svg = d3.select(this.heatmapRef.current).attr('width', 500).attr('height', 500);
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };
    const inner_width = 400, inner_height = 400;

    const heatmap = svg.selectAll('g').data([0]).join('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().range([0, inner_width]).domain(metrics).padding(0.01);
    const y = d3.scaleBand().range([inner_height, 0]).domain(metrics).padding(0.01);
    const color = d3.scaleLinear().range(['blue', 'white', 'red']).domain([-1, 0, 1]);

    heatmap.selectAll('rect').data(data).join('rect')
      .attr('x', d => x(d.variable1))
      .attr('y', d => y(d.variable2))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('fill', d => color(d.correlation))
      .on('mouseover', () => tooltip.style('opacity', 1))
      .on('mousemove', (event, d) => {
        tooltip
          .style('left', `${event.pageX}px`)
          .style('top', `${event.pageY - 25}px`)
          .html(`Correlation of ${d.variable1} and ${d.variable2}: ${d.correlation.toFixed(2)}`);
      })
      .on('mouseleave', () => tooltip.style('opacity', 0));

    heatmap.selectAll('.x-axis').data([0]).join('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${inner_height})`)
      .call(d3.axisBottom(x));

    heatmap.selectAll('.y-axis').data([0]).join('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y));
  };

  render() {
    const { minAge, maxAge, sliderValue, pendingNumPoints, heatmapFilter } = this.state;

    return (
      <div className="App">
        <h2>Scatterplot: Age vs Weight</h2>
        <input type="range" min={minAge} max={maxAge} value={sliderValue}
          onChange={e => this.setState({ sliderValue: +e.target.value })} />
        <div>Selected Age: {sliderValue}</div>
        <label>
          Number of Points:
          <input type="number" min="1" max="70000" value={pendingNumPoints}
            onChange={e => this.setState({ pendingNumPoints: Math.max(1, +e.target.value) })} />
        </label>
        <button onClick={() => {
          const { pendingNumPoints } = this.state;
          this.setState(prev => ({
            numPoints: pendingNumPoints,
            filteredData: prev.data.filter(d => d.age_years_float <= prev.sliderValue).slice(0, pendingNumPoints)
          }), this.updateChart);
        }}>Update Points</button>

        <svg ref={this.svgRef}></svg>
        <div ref={this.tooltipRef} style={{
          position: 'absolute',
          visibility: 'hidden',
          background: 'lightgray',
          padding: '5px',
          borderRadius: '5px'
        }}></div>

        <h2>Correlation Heatmap</h2>
        <div>
          {['all', 'cardio_0', 'cardio_1'].map(f => (
            <label key={f}>
              <input type="radio" name="filter" value={f}
                checked={heatmapFilter === f}
                onChange={e => this.setState({ heatmapFilter: e.target.value })} />
              {f.replace('_', ' ').toUpperCase()}
            </label>
          ))}
        </div>
        <svg ref={this.heatmapRef}></svg>
      </div>
    );
  }
}

export default App;
