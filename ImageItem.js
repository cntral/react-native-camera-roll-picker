import React, { Component } from 'react';
import {
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import PropTypes from 'prop-types';

const checkIcon = require('./circle-check.png');
const videoIcon = require('./videocam.png');

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'transparent',
  },
  videoMarker: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'transparent',
    width: 50,
    height: 30
  },
});

class ImageItem extends Component {
  state = {
    imageSize: null,
    isMounting: true
  }

  componentDidMount() {
    let { width } = Dimensions.get('window');
    const { imageMargin, imagesPerRow, containerWidth } = this.props;

    if (typeof containerWidth !== 'undefined') {
      width = containerWidth;
    }
    const imageSize = (width - (imagesPerRow + 1) * imageMargin) / imagesPerRow;

    this.setState({ imageSize, isMounting: false });
  }

  handleClick(item) {
    this.props.onClick(item);
  }

  render() {
    if ( this.state.isMounting ) return null;

    const {
      item, selected, selectedMarker, imageMargin,
    } = this.props;

    let videoMarker;
    if ( item.node.type.startsWith( "video" ) )
      videoMarker = <Image style={styles.videoMarker} source={videoIcon} accessibilityLabel="videoMarker" />;

    const marker = selectedMarker || (<Image
      style={[styles.marker, { width: 25, height: 25 }]}
      source={checkIcon}
    />);

    const { image } = item.node;

    return (
      <TouchableOpacity
        style={{ marginBottom: imageMargin, marginRight: imageMargin }}
        onPress={() => this.handleClick(image)}
        accessibilityLabel={ item.node.type.startsWith( "video" ) ? "videoThumbnail" : "imageThumbnail" }
      >
        <Image
          source={{ uri: image.uri }}
          style={{ height: this.state.imageSize, width: this.state.imageSize }}
        />
        {videoMarker}
        {(selected) ? marker : null}
      </TouchableOpacity>
    );
  }
}

ImageItem.defaultProps = {
  item: {},
  selected: false,
};

ImageItem.propTypes = {
  item: PropTypes.object,
  selected: PropTypes.bool,
  selectedMarker: PropTypes.element,
  imageMargin: PropTypes.number,
  imagesPerRow: PropTypes.number,
  onClick: PropTypes.func,
};

export default ImageItem;
