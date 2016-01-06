var React = require('react-native');
var {
  StyleSheet,
  PropTypes,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  Image,
} = React;

var MapView = require('../components/MapView');
var PriceMarker = require('./PriceMarker');
var CustomCallout = require('./CustomCallout');

var { width, height } = Dimensions.get('window');

const ASPECT_RATIO = width / height;
const LATITUDE = 37.78825;
const LONGITUDE = -122.4324;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const SPACE = 0.01;

var Callouts = React.createClass({
  getInitialState() {
    return {
      region: {
        latitude: LATITUDE,
        longitude: LONGITUDE,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      },
      markers: [
        {
          coordinate: {
            latitude: LATITUDE + SPACE,
            longitude: LONGITUDE + SPACE,
          },
        },
        {
          coordinate: {
            latitude: LATITUDE,
            longitude: LONGITUDE,
          },
        },
        {
          coordinate: {
            latitude: LATITUDE + SPACE,
            longitude: LONGITUDE - SPACE,
          },
        },
      ],
    };
  },

  render() {
    const { region, markers } = this.state;
    return (
      <View style={styles.container}>
        <MapView
          style={styles.map}
          initialRegion={region}
        >
          <MapView.Marker
            coordinate={markers[0].coordinate}
            title="This is a title"
            description="This is a description"
          />
          <MapView.Marker coordinate={markers[1].coordinate}>
            <MapView.Callout>
              <View>
                <Text>This is a plain view</Text>
              </View>
            </MapView.Callout>
          </MapView.Marker>
          <MapView.Marker
            coordinate={markers[2].coordinate}
            calloutOffset={{ x: -8, y: 28 }}
          >
            <MapView.Callout tooltip>
              <CustomCallout>
                <Text style={{ color: '#fff' }}>This is a custom callout bubble view</Text>
              </CustomCallout>
            </MapView.Callout>
          </MapView.Marker>
        </MapView>
        <View style={styles.buttonContainer}>
          <View style={styles.bubble}>
            <Text>Tap on markers to see different callouts</Text>
          </View>
        </View>
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
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
  },
  latlng: {
    width: 200,
    alignItems: 'stretch',
  },
  button: {
    width: 80,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginVertical: 20,
    backgroundColor: 'transparent',
  },
});

module.exports = Callouts;
