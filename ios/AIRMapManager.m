/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "RCTViewManager.h"
#import "AIRMapManager.h"

#import "RCTBridge.h"
#import "RCTUIManager.h"
#import "RCTConvert+CoreLocation.h"
#import "RCTConvert+MapKit.h"
#import "RCTEventDispatcher.h"
#import "AIRMap.h"
#import "UIView+React.h"
#import "AIRMapMarker.h"
#import "RCTViewManager.h"
#import "RCTConvert.h"
#import "AIRMapPolyline.h"
#import "AIRMapPolygon.h"
#import "AIRMapCircle.h"
#import "SMCalloutView.h"

#import <MapKit/MapKit.h>

static NSString *const RCTMapViewKey = @"MapView";


@interface AIRMapManager() <MKMapViewDelegate>

@end

@implementation AIRMapManager

RCT_EXPORT_MODULE()

- (UIView *)view
{
    AIRMap *map = [AIRMap new];
    map.delegate = self;

    // MKMapView doesn't report tap events, so we attach gesture recognizers to it
    UITapGestureRecognizer *tap = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleMapTap:)];
    UILongPressGestureRecognizer *longPress = [[UILongPressGestureRecognizer alloc] initWithTarget:self action:@selector(handleMapLongPress:)];
    // setting this to NO allows the parent MapView to continue receiving marker selection events
    tap.cancelsTouchesInView = NO;
    longPress.cancelsTouchesInView = NO;

    [map addGestureRecognizer:tap];
    [map addGestureRecognizer:longPress];

    return map;
}

RCT_EXPORT_VIEW_PROPERTY(showsUserLocation, BOOL)
RCT_EXPORT_VIEW_PROPERTY(showsPointsOfInterest, BOOL)
RCT_EXPORT_VIEW_PROPERTY(showsBuildings, BOOL)
RCT_EXPORT_VIEW_PROPERTY(showsCompass, BOOL)
RCT_EXPORT_VIEW_PROPERTY(showsScale, BOOL)
RCT_EXPORT_VIEW_PROPERTY(showsTraffic, BOOL)
RCT_EXPORT_VIEW_PROPERTY(zoomEnabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(scrollEnabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(maxDelta, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(minDelta, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(legalLabelInsets, UIEdgeInsets)
RCT_EXPORT_VIEW_PROPERTY(mapType, MKMapType)
RCT_EXPORT_VIEW_PROPERTY(onChange, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPress, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onLongPress, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMarkerPress, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMarkerSelect, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMarkerDeselect, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onCalloutPress, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(initialRegion, MKCoordinateRegion)

RCT_CUSTOM_VIEW_PROPERTY(region, MKCoordinateRegion, AIRMap)
{
    if (json == nil) return;

    // don't emit region change events when we are setting the region
    BOOL originalIgnore = view.ignoreRegionChanges;
    view.ignoreRegionChanges = YES;
    [view setRegion:[RCTConvert MKCoordinateRegion:json] animated:NO];
    view.ignoreRegionChanges = originalIgnore;
}


#pragma mark exported MapView methods

RCT_EXPORT_METHOD(animateToRegion:(nonnull NSNumber *)reactTag
        withRegion:(MKCoordinateRegion)region
        withDuration:(CGFloat)duration)
{
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        id view = viewRegistry[reactTag];
        if (![view isKindOfClass:[AIRMap class]]) {
            RCTLogError(@"Invalid view returned from registry, expecting AIRMap, got: %@", view);
        } else {
            [(AIRMap *)view setRegion:region animated:YES];
        }
    }];
}

RCT_EXPORT_METHOD(animateToCoordinate:(nonnull NSNumber *)reactTag
        withRegion:(CLLocationCoordinate2D)latlng
        withDuration:(CGFloat)duration)
{
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        id view = viewRegistry[reactTag];
        if (![view isKindOfClass:[AIRMap class]]) {
            RCTLogError(@"Invalid view returned from registry, expecting AIRMap, got: %@", view);
        } else {
            AIRMap *mapView = (AIRMap *)view;
            MKCoordinateRegion region;
            region.span = mapView.region.span;
            region.center = latlng;
            [mapView setRegion:region animated:YES];
        }
    }];
}

RCT_EXPORT_METHOD(fitToElements:(nonnull NSNumber *)reactTag
        animated:(BOOL)animated)
{
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        id view = viewRegistry[reactTag];
        if (![view isKindOfClass:[AIRMap class]]) {
            RCTLogError(@"Invalid view returned from registry, expecting AIRMap, got: %@", view);
        } else {
            AIRMap *mapView = (AIRMap *)view;
            // TODO(lmr): we potentially want to include overlays here... and could concat the two arrays together.
            [mapView showAnnotations:mapView.annotations animated:animated];
        }
    }];
}

#pragma mark Gesture Recognizer Handlers

- (void)handleMapTap:(UITapGestureRecognizer *)recognizer {
    AIRMap *map = (AIRMap *)recognizer.view;
    if (!map.onPress) return;

    CGPoint touchPoint = [recognizer locationInView:map];
    CLLocationCoordinate2D coord = [map convertPoint:touchPoint toCoordinateFromView:map];

    map.onPress(@{
            @"coordinate": @{
                    @"latitude": @(coord.latitude),
                    @"longitude": @(coord.longitude),
            },
            @"position": @{
                    @"x": @(touchPoint.x),
                    @"y": @(touchPoint.y),
            },
    });

}

- (void)handleMapLongPress:(UITapGestureRecognizer *)recognizer {

    // NOTE: android only does the equivalent of "began", so we only send in this case
    if (recognizer.state != UIGestureRecognizerStateBegan) return;

    AIRMap *map = (AIRMap *)recognizer.view;
    if (!map.onLongPress) return;

    CGPoint touchPoint = [recognizer locationInView:map];
    CLLocationCoordinate2D coord = [map convertPoint:touchPoint toCoordinateFromView:map];

    map.onLongPress(@{
            @"coordinate": @{
                    @"latitude": @(coord.latitude),
                    @"longitude": @(coord.longitude),
            },
            @"position": @{
                    @"x": @(touchPoint.x),
                    @"y": @(touchPoint.y),
            },
    });
}

#pragma mark MKMapViewDelegate

#pragma mark Polyline stuff

- (MKOverlayRenderer *)mapView:(MKMapView *)mapView rendererForOverlay:(id <MKOverlay>)overlay{
    if ([overlay isKindOfClass:[AIRMapPolyline class]]) {
        return ((AIRMapPolyline *)overlay).renderer;
    } else if ([overlay isKindOfClass:[AIRMapPolygon class]]) {
        return ((AIRMapPolygon *)overlay).renderer;
    } else if ([overlay isKindOfClass:[AIRMapCircle class]]) {
        return ((AIRMapCircle *)overlay).renderer;
    } else {
        return nil;
    }
}


#pragma mark Annotation Stuff



- (void)mapView:(AIRMap *)mapView didSelectAnnotationView:(MKAnnotationView *)view
{
    if (![view.annotation isKindOfClass:[AIRMapMarker class]]) return;
    AIRMapMarker *marker = (AIRMapMarker *)view.annotation;

    id event = @{
            @"action": @"marker-select",
            @"id": marker.identifier ?: @"unknown",
            @"coordinate": @{
                    @"latitude": @(marker.coordinate.latitude),
                    @"longitude": @(marker.coordinate.longitude)
            }
    };

    if (mapView.onMarkerSelect) mapView.onMarkerSelect(event);
    if (marker.onSelect) marker.onSelect(event);

    if (![marker shouldShowCalloutView]) {
        // no callout to show
        return;
    }

    [marker fillCalloutView:mapView.calloutView];

    // This is where we present our custom callout view... MapKit's built-in callout doesn't have the flexibility
    // we need, but a lot of work was done by Nick Farina to make this identical to MapKit's built-in.
    [mapView.calloutView presentCalloutFromRect:view.bounds
                                         inView:view
                              constrainedToView:mapView
                                       animated:YES];
}

- (void)mapView:(AIRMap *)mapView didDeselectAnnotationView:(MKAnnotationView *)view {
    // hide the callout view
    [mapView.calloutView dismissCalloutAnimated:YES];

    if (![view.annotation isKindOfClass:[AIRMapMarker class]]) return;
    AIRMapMarker *marker = (AIRMapMarker *)view.annotation;

    id event = @{
            @"action": @"marker-deselect",
            @"id": marker.identifier ?: @"unknown",
            @"coordinate": @{
                    @"latitude": @(marker.coordinate.latitude),
                    @"longitude": @(marker.coordinate.longitude)
            }
    };

    if (mapView.onMarkerDeselect) mapView.onMarkerDeselect(event);
    if (marker.onDeselect) marker.onDeselect(event);

}

- (MKAnnotationView *)mapView:(__unused AIRMap *)mapView viewForAnnotation:(AIRMapMarker *)marker
{
    marker.map = mapView;
    return [marker getAnnotationView];
}

- (void)mapView:(AIRMap *)mapView didUpdateUserLocation:(MKUserLocation *)location
{
    if (mapView.followUserLocation) {
        MKCoordinateRegion region;
        region.span.latitudeDelta = RCTMapDefaultSpan;
        region.span.longitudeDelta = RCTMapDefaultSpan;
        region.center = location.coordinate;
        [mapView setRegion:region animated:YES];

        // Move to user location only for the first time it loads up.
        mapView.followUserLocation = NO;
    }
}

- (void)mapView:(AIRMap *)mapView regionWillChangeAnimated:(__unused BOOL)animated
{
    [self _regionChanged:mapView];

    mapView.regionChangeObserveTimer = [NSTimer timerWithTimeInterval:RCTMapRegionChangeObserveInterval
                                                               target:self
                                                             selector:@selector(_onTick:)
                                                             userInfo:@{ RCTMapViewKey: mapView }
                                                              repeats:YES];

    [[NSRunLoop mainRunLoop] addTimer:mapView.regionChangeObserveTimer forMode:NSRunLoopCommonModes];
}

- (void)mapView:(AIRMap *)mapView regionDidChangeAnimated:(__unused BOOL)animated
{
    [mapView.regionChangeObserveTimer invalidate];
    mapView.regionChangeObserveTimer = nil;

    [self _regionChanged:mapView];

    // Don't send region did change events until map has
    // started rendering, as these won't represent the final location
    if (mapView.hasStartedRendering) {
        [self _emitRegionChangeEvent:mapView continuous:NO];
    };

    mapView.pendingCenter = mapView.region.center;
    mapView.pendingSpan = mapView.region.span;
}

- (void)mapViewWillStartRenderingMap:(AIRMap *)mapView
{
    mapView.hasStartedRendering = YES;
    [self _emitRegionChangeEvent:mapView continuous:NO];
}

#pragma mark Private

- (void)_onTick:(NSTimer *)timer
{
    [self _regionChanged:timer.userInfo[RCTMapViewKey]];
}

- (void)_regionChanged:(AIRMap *)mapView
{
    BOOL needZoom = NO;
    CGFloat newLongitudeDelta = 0.0f;
    MKCoordinateRegion region = mapView.region;
    // On iOS 7, it's possible that we observe invalid locations during initialization of the map.
    // Filter those out.
    if (!CLLocationCoordinate2DIsValid(region.center)) {
        return;
    }
    // Calculation on float is not 100% accurate. If user zoom to max/min and then move, it's likely the map will auto zoom to max/min from time to time.
    // So let's try to make map zoom back to 99% max or 101% min so that there are some buffer that moving the map won't constantly hitting the max/min bound.
    if (mapView.maxDelta > FLT_EPSILON && region.span.longitudeDelta > mapView.maxDelta) {
        needZoom = YES;
        newLongitudeDelta = mapView.maxDelta * (1 - RCTMapZoomBoundBuffer);
    } else if (mapView.minDelta > FLT_EPSILON && region.span.longitudeDelta < mapView.minDelta) {
        needZoom = YES;
        newLongitudeDelta = mapView.minDelta * (1 + RCTMapZoomBoundBuffer);
    }
    if (needZoom) {
        region.span.latitudeDelta = region.span.latitudeDelta / region.span.longitudeDelta * newLongitudeDelta;
        region.span.longitudeDelta = newLongitudeDelta;
        mapView.region = region;
    }

    // Continously observe region changes
    [self _emitRegionChangeEvent:mapView continuous:YES];
}

- (void)_emitRegionChangeEvent:(AIRMap *)mapView continuous:(BOOL)continuous
{
    if (!mapView.ignoreRegionChanges && mapView.onChange) {
        MKCoordinateRegion region = mapView.region;
        if (!CLLocationCoordinate2DIsValid(region.center)) {
            return;
        }

#define FLUSH_NAN(value) (isnan(value) ? 0 : value)
        mapView.onChange(@{
                @"continuous": @(continuous),
                @"region": @{
                        @"latitude": @(FLUSH_NAN(region.center.latitude)),
                        @"longitude": @(FLUSH_NAN(region.center.longitude)),
                        @"latitudeDelta": @(FLUSH_NAN(region.span.latitudeDelta)),
                        @"longitudeDelta": @(FLUSH_NAN(region.span.longitudeDelta)),
                }
        });
    }
}

@end
