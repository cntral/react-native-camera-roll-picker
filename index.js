import React, { Component } from 'react';
import {
  ActivityIndicator,
  FlatList,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TextPropTypes } from "deprecated-react-native-prop-types";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import PropTypes from 'prop-types';
import Row from './Row';

import ImageItem from './ImageItem';

const styles = StyleSheet.create({
  wrapper: {
    flexGrow: 1,
  },
  loader: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// helper functions
const arrayObjectIndexOf = (array, property, value) => array.map(o => o[property]).indexOf(value);

const nEveryRow = (data, n) => {
  const result = [];
  let temp = [];

  for (let i = 0; i < data.length; ++i) {
    if (i > 0 && i % n === 0) {
      result.push(temp);
      temp = [];
    }
    temp.push(data[i]);
  }

  if (temp.length > 0) {
    while (temp.length !== n) {
      temp.push(null);
    }
    result.push(temp);
  }

  return result;
};

class CameraRollPicker extends Component {
  constructor(props) {
    super(props);

    this.state = {
      hasAndroidPermission: false,
      images: [],
      selected: this.props.selected,
      lastCursor: null,
      initialLoading: true,
      loadingMore: false,
      noMore: false,
      data: [],
    };

    this.renderFooterSpinner = this.renderFooterSpinner.bind(this);
    this.onEndReached = this.onEndReached.bind(this);
    this.renderRow = this.renderRow.bind(this);
    this.selectImage = this.selectImage.bind(this);
    this.renderImage = this.renderImage.bind(this);
  }

  async componentDidMount() {
    if (Platform.OS === "android") {
      const hasAndroidPermission = await this.hasAndroidPermission();
      this.setState({hasAndroidPermission});

      if (!hasAndroidPermission) return this.setState({initialLoading: false});
    }

    this.fetch();
  }

  componentDidUpdate(prevProps) {
    if (JSON.stringify(prevProps.selected) !== JSON.stringify( this.props.selected)) { // Only update `this.state.selected` if `this.props.selected` changes. Without this `if`, it causes an infinite loop.
      this.setState({
        selected: this.props.selected,
      });
    }
  }

  // Ensure we have the correct permissions read external storage on Android (required for Android 10+).
  // Pulled straight from cameraroll README.
  // See https://github.com/react-native-cameraroll/react-native-cameraroll#permissions.
  async hasAndroidPermission() {
    const getCheckPermissionPromise = () => {
      if (Platform.Version >= 33) {
        return Promise.all([
          PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES),
          PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO),
        ]).then(
          ([hasReadMediaImagesPermission, hasReadMediaVideoPermission]) =>
            hasReadMediaImagesPermission && hasReadMediaVideoPermission,
        );
      } else {
        return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
      }
    };

    const hasPermission = await getCheckPermissionPromise();
    if (hasPermission) {
      return true;
    }
    const getRequestPermissionPromise = () => {
      if (Platform.Version >= 33) {
        return PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        ]).then(
          (statuses) =>
            statuses[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] ===
              PermissionsAndroid.RESULTS.GRANTED &&
            statuses[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] ===
              PermissionsAndroid.RESULTS.GRANTED,
        );
      } else {
        return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE).then((status) => status === PermissionsAndroid.RESULTS.GRANTED);
      }
    };

    return await getRequestPermissionPromise();
  }

  onEndReached() {
    if (!this.state.noMore) {
      this.fetch();
    }
  }

  appendImages(data) {
    const assets = data.edges;
    const newState = {
      loadingMore: false,
      initialLoading: false,
    };

    if (!data.page_info.has_next_page) {
      newState.noMore = true;
    }

    if (assets.length > 0) {
      newState.lastCursor = data.page_info.end_cursor;
      newState.images = this.state.images.concat(assets);
      newState.data = nEveryRow(newState.images, this.props.imagesPerRow);
    }

    this.setState(newState);
  }

  fetch() {
    if (!this.state.loadingMore) {
      this.setState({ loadingMore: true }, () => { this.doFetch(); });
    }
  }

  doFetch() {
    const { groupTypes, assetType } = this.props;

    const fetchParams = {
      first: 100,
      groupTypes,
      assetType,
    };

    if (Platform.OS === 'android') {
      // not supported in android
      delete fetchParams.groupTypes;
    }

    if (this.state.lastCursor) {
      fetchParams.after = this.state.lastCursor;
    }

    fetchParams.include = [ "playableDuration" ]; // Include playableDuration by default as this will remove thumbnails that don't exist. e.g. /storage/emulated/0/ddmsrec.mp4 from screen recording.

    CameraRoll.getPhotos(fetchParams)
      .then(data => {
        data.edges.sort((a, b) => b.node.timestamp - a.node.timestamp); // We have to sort the images by `timestamp` because `getPhotos` sometimes doesn't. See this issue: https://github.com/react-native-cameraroll/react-native-cameraroll/issues/45.
        this.appendImages(data);
      })
      .catch(error => console.error(error));
  }

  selectImage(image) {
    const {
      maximum, imagesPerRow, callback, selectSingleItem,
    } = this.props;

    const { selected } = this.state;
    const index = arrayObjectIndexOf(selected, 'uri', image.uri);

    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      if (selectSingleItem) {
        selected.splice(0, selected.length);
      }
      if (selected.length < maximum) {
        selected.push(image);
      }
    }

    this.setState({
      selected,
      data: nEveryRow(this.state.images, imagesPerRow),
    });

    callback(selected, image);
  }

  renderImage(item) {
    const { selected } = this.state;
    const {
      imageMargin,
      selectedMarker,
      imagesPerRow,
      containerWidth,
    } = this.props;

    const { uri } = item.node.image;
    const isSelected = (arrayObjectIndexOf(selected, 'uri', uri) >= 0);

    return (
      <ImageItem
        key={uri}
        item={item}
        selected={isSelected}
        imageMargin={imageMargin}
        selectedMarker={selectedMarker}
        imagesPerRow={imagesPerRow}
        containerWidth={containerWidth}
        onClick={this.selectImage}
        showsFileName={this.props.showsFileNames}
      />
    );
  }

  renderRow(item) { // item is an array of objects
    const isSelected = item.map((imageItem) => {
      if (!imageItem) return false;
      const { uri } = imageItem.node.image;
      return arrayObjectIndexOf(this.state.selected, 'uri', uri) >= 0;
    });
    return (<Row
      rowData={item}
      isSelected={isSelected}
      selectImage={this.selectImage}
      imagesPerRow={this.props.imagesPerRow}
      containerWidth={this.props.containerWidth}
      imageMargin={this.props.imageMargin}
      selectedMarker={this.props.selectedMarker}
      showsFileNames={this.props.showsFileNames}
    />);
  }

  renderFooterSpinner() {
    if (!this.state.noMore) {
      return <ActivityIndicator style={styles.spinner} />;
    }
    return null;
  }

  render() {
    const {
      initialNumToRender,
      imageMargin,
      backgroundColor,
      emptyText,
      emptyTextStyle,
      loader,
      missingPermissionText,
      missingPermissionTextStyle
    } = this.props;

    if (this.state.initialLoading) return (
      <View style={[styles.loader, { backgroundColor }]}>
        { loader || <ActivityIndicator /> }
      </View>
    );

    if (Platform.OS === 'android' && !this.state.hasAndroidPermission) return (
      <Text style={[{ textAlign: 'center' }, missingPermissionTextStyle]}>{missingPermissionText}</Text>
    );

    const flatListOrEmptyText = this.state.data.length > 0 ? (
      <FlatList
        style={{ flex: 1 }}
        ListFooterComponent={this.renderFooterSpinner}
        initialNumToRender={initialNumToRender}
        onEndReached={this.onEndReached}
        renderItem={({ item }) => this.renderRow(item)}
        keyExtractor={item => item[0].node.image.uri}
        data={this.state.data}
        extraData={this.state.selected}
      />
    ) : (
      <Text style={[{ textAlign: 'center' }, emptyTextStyle]}>{emptyText}</Text>
    );

    return (
      <View
        style={[styles.wrapper, { padding: imageMargin, paddingRight: 0, backgroundColor }]}
      >
        {flatListOrEmptyText}
      </View>
    );
  }
}

CameraRollPicker.propTypes = {
  initialNumToRender: PropTypes.number,
  groupTypes: PropTypes.oneOf([
    'Album',
    'All',
    'Event',
    'Faces',
    'Library',
    'PhotoStream',
    'SavedPhotos',
  ]),
  maximum: PropTypes.number,
  assetType: PropTypes.oneOf([
    'Photos',
    'Videos',
    'All',
  ]),
  selectSingleItem: PropTypes.bool,
  imagesPerRow: PropTypes.number,
  imageMargin: PropTypes.number,
  containerWidth: PropTypes.number,
  callback: PropTypes.func,
  selected: PropTypes.array,
  selectedMarker: PropTypes.element,
  backgroundColor: PropTypes.string,
  emptyText: PropTypes.string,
  emptyTextStyle: TextPropTypes.style,
  loader: PropTypes.node,
  showsFileNames: PropTypes.bool,
  missingPermissionText: PropTypes.string,
  missingPermissionTextStyle: TextPropTypes.style,
};

CameraRollPicker.defaultProps = {
  initialNumToRender: 5,
  groupTypes: 'SavedPhotos',
  maximum: 15,
  imagesPerRow: 3,
  imageMargin: 5,
  selectSingleItem: false,
  assetType: 'Photos',
  backgroundColor: 'white',
  selected: [],
  callback(selectedImages, currentImage) {
    console.log(currentImage);
    console.log(selectedImages);
  },
  emptyText: 'No photos.',
  showsFileNames: false,
  missingPermissionText: 'Missing "Photos and videos" permission. Please grant permission and try again.',
};

export default CameraRollPicker;
