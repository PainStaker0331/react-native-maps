var React = require('react-native');
var {
  StyleSheet,
  PropTypes,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  Animated,
  Platform,
} = React;

var MapView = require('react-native-maps');
var PanController = require('./PanController');
var PriceMarker = require('./AnimatedPriceMarker');

var screen = Dimensions.get('window');

const ASPECT_RATIO = screen.width / screen.height;
const LATITUDE = 37.78825;
const LONGITUDE = -122.4324;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

var ITEM_SPACING = 10;
var ITEM_PREVIEW = 10;
var ITEM_WIDTH = screen.width - 2 * ITEM_SPACING - 2 * ITEM_PREVIEW;
var SNAP_WIDTH = ITEM_WIDTH + ITEM_SPACING;
var ITEM_PREVIEW_HEIGHT = 150;
var SCALE_END = screen.width / ITEM_WIDTH;
var BREAKPOINT1 = 246;
var BREAKPOINT2 = 350;

const ANDROID = Platform.OS === 'android';

var AnimatedViews = React.createClass({
  getInitialState() {
    const panX = new Animated.Value(0);
    const panY = new Animated.Value(0);

    const scrollY = panY.interpolate({
      inputRange: [-1, 1],
      outputRange: [1, -1],
    });

    const scrollX = panX.interpolate({
      inputRange: [-1, 1],
      outputRange: [1, -1],
    });

    const scale = scrollY.interpolate({
      inputRange: [0, BREAKPOINT1],
      outputRange: [1, 1.6],
      extrapolate: 'clamp',
    });

    const translateY = scrollY.interpolate({
      inputRange: [0, BREAKPOINT1],
      outputRange: [0, -100],
      extrapolate: 'clamp',
    });

    const ONE = new Animated.Value(1);

    const markers = [
      {
        id: 0,
        amount: 99,
        coordinate: {
          latitude: LATITUDE,
          longitude: LONGITUDE,
        },
      },
      {
        id: 1,
        amount: 199,
        coordinate: {
          latitude: LATITUDE + 0.004,
          longitude: LONGITUDE - 0.004,
        },
      },
      {
        id: 2,
        amount: 285,
        coordinate: {
          latitude: LATITUDE - 0.004,
          longitude: LONGITUDE - 0.004,
        },
      },
    ];

    const animations = markers.map((m, i)  => {
      const xLeft = -SNAP_WIDTH * i + SNAP_WIDTH/2;
      const xRight = -SNAP_WIDTH * i - SNAP_WIDTH/2;
      const xPos = -SNAP_WIDTH * i;

      const isIndex = panX.interpolate({
        inputRange: [xRight - 1, xRight, xLeft, xLeft+1],
        outputRange: [0, 1, 1, 0],
        extrapolate: 'clamp',
      });

      const isNotIndex = panX.interpolate({
        inputRange: [xRight - 1, xRight, xLeft, xLeft+1],
        outputRange: [1, 0, 0, 1],
        extrapolate: 'clamp',
      });

      const center = panX.interpolate({
        inputRange: [xPos - 10, xPos, xPos + 10],
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
      });

      const selected = panX.interpolate({
        inputRange: [xRight, xPos, xLeft],
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
      });

      const translateY = Animated.multiply(isIndex, panY);

      const translateX = panX;

      const anim = Animated.multiply(isIndex, scrollY.interpolate({
        inputRange: [0, BREAKPOINT1],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }));

      const scale = Animated.add(ONE, Animated.multiply(isIndex, scrollY.interpolate({
        inputRange: [BREAKPOINT1, BREAKPOINT2],
        outputRange: [0, SCALE_END-1],
        extrapolate: 'clamp',
      })));

      // [0 => 1]
      var opacity = scrollY.interpolate({
        inputRange: [BREAKPOINT1, BREAKPOINT2],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      });

      // if i === index: [0 => 0]
      // if i !== index: [0 => 1]
      opacity = Animated.multiply(isNotIndex, opacity);


      // if i === index: [1 => 1]
      // if i !== index: [1 => 0]
      opacity = opacity.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      });

      var markerOpacity = scrollY.interpolate({
        inputRange: [0, BREAKPOINT1],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      });

      markerOpacity = Animated.multiply(isNotIndex, markerOpacity).interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      });

      var markerScale = selected.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.2],
      });

      return {
        translateY,
        translateX,
        scale,
        opacity,
        anim,
        center,
        selected,
        markerOpacity,
        markerScale,
      };
    });

    return {
      panX,
      panY,
      animations,
      index: 0,
      canMoveHorizontal: true,
      scrollY,
      scrollX,
      scale,
      translateY,
      markers,
      region: new Animated.Region({
        latitude: LATITUDE,
        longitude: LONGITUDE,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      }),
    };
  },

  componentDidMount() {
    var { region, panX, panY, scrollX, markers } = this.state;

    panX.addListener(this.onPanXChange);
    panY.addListener(this.onPanYChange);

    region.stopAnimation();
    region.timing({
      latitude: scrollX.interpolate({
        inputRange: markers.map((m, i) => i * SNAP_WIDTH),
        outputRange: markers.map(m => m.coordinate.latitude),
      }),
      longitude: scrollX.interpolate({
        inputRange: markers.map((m, i) => i * SNAP_WIDTH),
        outputRange: markers.map(m => m.coordinate.longitude),
      }),
      duration: 0,
    }).start();
  },

  onStartShouldSetPanResponder(e) {
    // we only want to move the view if they are starting the gesture on top
    // of the view, so this calculates that and returns true if so. If we return
    // false, the gesture should get passed to the map view appropriately.
    var { panY } = this.state;
    var { pageY } = e.nativeEvent;
    var topOfMainWindow = ITEM_PREVIEW_HEIGHT + 1 * panY.__getValue();
    var topOfTap = screen.height - pageY;

    return topOfTap < topOfMainWindow;
  },

  onMoveShouldSetPanResponder(e) {
    var { panY } = this.state;
    var { pageY } = e.nativeEvent;
    var topOfMainWindow = ITEM_PREVIEW_HEIGHT + 1 * panY.__getValue();
    var topOfTap = screen.height - pageY;

    return topOfTap < topOfMainWindow;
  },

  onPanXChange({ value }) {
    var { index, region, panX, markers } = this.state;
    var newIndex = Math.floor((-1 * value + SNAP_WIDTH / 2) / SNAP_WIDTH);
    if (index !== newIndex) {
      this.setState({ index: newIndex });
    }
  },

  onPanYChange({ value }) {
    var { canMoveHorizontal, region, scrollY, scrollX, markers, index } = this.state;
    var shouldBeMovable = Math.abs(value) < 2;
    if (shouldBeMovable !== canMoveHorizontal) {
      this.setState({ canMoveHorizontal: shouldBeMovable });
      if (!shouldBeMovable) {
        var { coordinate } = markers[index];
        region.stopAnimation();
        region.timing({
          latitude: scrollY.interpolate({
            inputRange: [0, BREAKPOINT1],
            outputRange: [coordinate.latitude, coordinate.latitude - LATITUDE_DELTA * 0.5 * 0.375],
            extrapolate: 'clamp',
          }),
          latitudeDelta: scrollY.interpolate({
            inputRange: [0, BREAKPOINT1],
            outputRange: [LATITUDE_DELTA, LATITUDE_DELTA * 0.5],
            extrapolate: 'clamp',
          }),
          longitudeDelta: scrollY.interpolate({
            inputRange: [0, BREAKPOINT1],
            outputRange: [LONGITUDE_DELTA, LONGITUDE_DELTA * 0.5],
            extrapolate: 'clamp',
          }),
          duration: 0,
        }).start();
      } else {
        region.stopAnimation();
        region.timing({
          latitude: scrollX.interpolate({
            inputRange: markers.map((m, i) => i * SNAP_WIDTH),
            outputRange: markers.map(m => m.coordinate.latitude),
          }),
          longitude: scrollX.interpolate({
            inputRange: markers.map((m, i) => i * SNAP_WIDTH),
            outputRange: markers.map(m => m.coordinate.longitude),
          }),
          duration: 0,
        }).start();
      }
    }
  },

  onRegionChange(region) {
    //this.state.region.setValue(region);
  },

  render() {
    const {
      panX,
      panY,
      animations,
      canMoveHorizontal,
      markers,
      region,
    } = this.state;

    return (
      <View style={styles.container}>
        <PanController
          style={styles.container}
          vertical
          horizontal={canMoveHorizontal}
          xMode="snap"
          snapSpacingX={SNAP_WIDTH}
          yBounds={[-1 * screen.height, 0]}
          xBounds={[-screen.width * (markers.length-1), 0]}
          panY={panY}
          panX={panX}
          onStartShouldSetPanResponder={this.onStartShouldSetPanResponder}
          onMoveShouldSetPanResponder={this.onMoveShouldSetPanResponder}
        >
          <MapView.Animated
            style={styles.map}
            region={region}
            onRegionChange={this.onRegionChange}
          >
            {markers.map((marker, i) => {
              const {
                selected,
                markerOpacity,
                markerScale,
              } = animations[i];

              return (
                <MapView.Marker
                  key={marker.id}
                  coordinate={marker.coordinate}
                >
                  <PriceMarker
                    style={{
                      opacity: markerOpacity,
                      transform: [
                        { scale: markerScale },
                      ],
                    }}
                    amount={marker.amount}
                    selected={selected}
                  />
                </MapView.Marker>
              );
            })}
          </MapView.Animated>
          <View style={styles.itemContainer}>
            {markers.map((marker, i) => {
              const {
                translateY,
                translateX,
                scale,
                opacity,
              } = animations[i];

              return (
                <Animated.View
                  key={marker.id}
                  style={[styles.item, {
                    opacity,
                    transform: [
                      { translateY },
                      { translateX },
                      { scale },
                    ],
                  }]}
                >
                </Animated.View>
              );
            })}
          </View>
        </PanController>
      </View>
    );
  },
});



var styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  itemContainer: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    paddingHorizontal: ITEM_SPACING / 2 + ITEM_PREVIEW,
    position: 'absolute',
    //top: screen.height - ITEM_PREVIEW_HEIGHT - 64,
    paddingTop: screen.height - ITEM_PREVIEW_HEIGHT - 64,
    //paddingTop: !ANDROID ? 0 : screen.height - ITEM_PREVIEW_HEIGHT - 64,
  },
  map: {
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  item: {
    width: ITEM_WIDTH,
    height: screen.height + 2 * ITEM_PREVIEW_HEIGHT,
    backgroundColor: 'red',
    marginHorizontal: ITEM_SPACING / 2,
    overflow: 'hidden',
    borderRadius: 3,
    borderColor: '#000',
  },
});

module.exports = AnimatedViews;
