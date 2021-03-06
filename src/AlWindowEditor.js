import React from 'react';
import PropTypes from 'prop-types';
import './css/AlWindowEditor.css';

let uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        let r = (Math.random() * 16) | 0,
            v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};
let defaultUuidFcn = uuidv4;

class AlWindowEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            contentSelectedNodeId: -1, // contentSelectedNodeId : node id selected for moving
            outputSelectedNodeId: -1,
            outputSelectedIdx: -1,
            resizeSelectedNodeId: -1,
            canvasMoveSelected: -1,
            editorSelectedNodeId: -1,

            canvasOffsetX: 0,
            canvasOffsetY: 0,

            currentMouseX: -1,
            currentMouseY: -1,
            mouseDownX: -1,
            mouseDownY: -1,
            mouseDownOffsetX: -1,
            mouseDownOffsetY: -1,

            // TODO : handle bad initial Input data. If bad person input nodeDescriptor and nodeLinks that contains
            //        none synchronized nodes, we can do some intelligent removal of node link here.
            // nodeDescriptors: an array of JSON that looks like : {
            //   "nodeId": 1,
            //   "nodeUuid": a uuid v4 generated randomly at node creation time by the browser
            //   "nodeType": "dummy",
            //   "data": {},
            //   "numInputs": 1,
            //   "numOutputs": 1,
            //   "display": {
            //     "offsetX": 43.5,
            //     "offsetY": 65,
            //     "width": 136.5,
            //     "height": 103
            //   }
            // }
            nodeDescriptors: props.initialNodeDescriptors ? [...props.initialNodeDescriptors] : [],
            // nodeLinks : an array of (outputNodeId, outputNodeIdx, inputNodeId, inputNodeIdx)
            // the semantics is a directed link from outputNodeId to inputNodeId, of the respective input/out box id
            //  the box ID's start with 0 (see getNodeWrapper)
            nodeLinks: props.initialNodeLinks ? [...props.initialNodeLinks] : [],

            // states for left component area:
            componentAreaOpen: false,
            // states for right editor component area:
            editorAreaOpen: false,
            // the search box at the top of the component area:
            componentSearchText: ''
        };
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (
            this.props.initialNodeDescriptors &&
            this.props.initialNodeDescriptors.length > 0 &&
            (!prevProps.initialNodeDescriptors || prevProps.initialNodeDescriptors.length == 0) &&
            this.state.nodeDescriptors.length == 0
        ) {
            /* catch React lifecycle. React will sometimes mount component without props, then supply
               the props. We have to detect that in order to ingest the initial node descriptors and node links.
               We are only detecting the case where the previous prop doesn't have initial descriptors but the
               current prop does. We assume that the component has finally supplied the initial node descriptors
               in this case.
             */
            this.setState({ nodeDescriptors: [...this.props.initialNodeDescriptors] });
        }
        if (
            this.props.initialNodeLinks &&
            this.props.initialNodeLinks.length > 0 &&
            (!prevProps.initialNodeLinks || prevProps.initialNodeLinks.length == 0) &&
            this.state.nodeLinks.length == 0
        ) {
            this.setState({ nodeLinks: [...this.props.initialNodeLinks] });
        }

        if (this.props.viewOnly) {
            return;
        }
        if (typeof this.props.updateCbkFcn == 'function') {
            let nodeDesc = this.state.nodeDescriptors;
            let nodeLinks = this.state.nodeLinks;
            if (
                this.state.canvasMoveSelected == -1 &&
                this.state.contentSelectedNodeId == -1 &&
                this.state.contentSelectedNodeId == -1 &&
                this.state.outputSelectedNodeId == -1 &&
                !(
                    this.state.editorAreaOpen === true &&
                    this.state.editorSelectedNodeId > -1 &&
                    !prevState.editorAreaOpen
                ) /*just opening the editor window by double clicking on a node*/ &&
                this.state.componentAreaOpen == prevState.componentAreaOpen &&
                this.state.componentSearchText == prevState.componentSearchText
            ) {
                try {
                    this.props.updateCbkFcn(nodeDesc, nodeLinks);
                } catch (cbkE) {
                    console.error(cbkE);
                }
            }
        }
    }
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    getComponentDescriptor = (componentTypeName) => {
        let componentRegistry = this.props.componentRegistry;
        if (
            typeof componentRegistry == 'undefined' ||
            !componentRegistry ||
            componentRegistry.length == 0
        ) {
            return null;
        }
        let componentDescriptor = componentRegistry.filter((elm) => {
            return elm.componentTypeName == componentTypeName;
        });
        if (!componentDescriptor || componentDescriptor.length == 0) {
            return null;
        }
        return componentDescriptor[0];
    };

    getDataUpdaterFcnForNodeId = (nodeId) => {
        let captureNodeId = nodeId;
        let me = this;
        return (newData) => {
            me.setNewDataForNodeIdToState(captureNodeId, newData);
        };
    };
    getNodeIdToNodeDescriptor = () => {
        let nodeDescriptors = this.state.nodeDescriptors;
        if (nodeDescriptors == null || nodeDescriptors.length == 0) {
            return {};
        }
        let nodeIdToDescriptor = {};
        let i = 0;
        for (i = 0; i < nodeDescriptors.length; ++i) {
            let descriptor = nodeDescriptors[i];
            nodeIdToDescriptor[descriptor.nodeId] = descriptor;
        }
        return nodeIdToDescriptor;
    };

    getPointerDiscretization = () => {
        let p = 1;
        if (this.props.pointerDiscretization) {
            try {
                p = Math.max(p, parseInt(this.props.pointerDiscretization));
            } catch (err) {}
        }
        return p;
    };

    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    canvasmousedown = (e) => {
        let dom = e.target;
        let canvas = dom.closest('.topCanvas');
        if (dom.classList.contains('alweResizeBox')) {
            if (this.props.viewOnly) {
                return;
            }
            let closestNodeWrapper = dom.closest('.alweNodeWrapper');
            if (closestNodeWrapper != null) {
                let offsetX = e.clientX - closestNodeWrapper.getBoundingClientRect().left;
                let offsetY = e.clientY - closestNodeWrapper.getBoundingClientRect().top;
                this.setState({
                    contentSelectedNodeId: -1,
                    outputSelectedNodeId: -1,
                    outputSelectedIdx: -1,
                    canvasMoveSelected: -1,
                    resizeSelectedNodeId: parseInt(closestNodeWrapper.dataset.nodeId),
                    mouseDownX: e.clientX - canvas.getBoundingClientRect().left,
                    mouseDownY: e.clientY - canvas.getBoundingClientRect().top
                });
            }
        } else if (
            dom.classList.contains('nodecontent') ||
            dom.parentNode.classList.contains('nodecontent')
        ) {
            if (this.props.viewOnly) {
                return;
            }
            let closestNodeWrapper = dom.closest('.alweNodeWrapper');
            if (closestNodeWrapper != null) {
                let mouseDownContentNodeId = closestNodeWrapper.dataset.nodeId;
                let offsetX = e.clientX - closestNodeWrapper.getBoundingClientRect().left;
                let offsetY = e.clientY - closestNodeWrapper.getBoundingClientRect().top;
                this.setState({
                    outputSelectedNodeId: -1,
                    outputSelectedIdx: -1,
                    resizeSelectedNodeId: -1,
                    canvasMoveSelected: -1,
                    contentSelectedNodeId: parseInt(mouseDownContentNodeId),
                    mouseDownOffsetX: offsetX,
                    mouseDownOffsetY: offsetY
                });
            }
        } else if (dom.classList.contains('alweOutput')) {
            if (this.props.viewOnly) {
                return;
            }
            let closestNodeWrapper = dom.closest('.alweNodeWrapper');
            let outputIdx = dom.dataset.idx;
            if (outputIdx != null) {
                if (typeof outputIdx == 'string' && outputIdx.startsWith('output_')) {
                    outputIdx = outputIdx.substr(7);
                }
                this.setState({
                    contentSelectedNodeId: -1,
                    resizeSelectedNodeId: -1,
                    canvasMoveSelected: -1,
                    mouseDownX: e.clientX - canvas.getBoundingClientRect().left,
                    mouseDownY: e.clientY - canvas.getBoundingClientRect().top,
                    outputSelectedNodeId: parseInt(closestNodeWrapper.dataset.nodeId),
                    outputSelectedIdx: parseInt(outputIdx)
                });
            }
        } else if (dom.classList.contains('topCanvas')) {
            this.setState({
                contentSelectedNodeId: -1,
                resizeSelectedNodeId: -1,
                outputSelectedNodeId: -1,
                canvasMoveSelected: 1,
                mouseDownX: e.clientX - dom.getBoundingClientRect().left,
                mouseDownY: e.clientY - dom.getBoundingClientRect().top
            });
        }
    };

    canvasmousemove = (e) => {
        let dom = e.target;
        let canvas = dom.closest('.topCanvas');
        if (this.state.contentSelectedNodeId != null && this.state.contentSelectedNodeId > -1) {
            let newWrapperX =
                e.clientX - this.state.mouseDownOffsetX - canvas.getBoundingClientRect().left;
            let newWrapperY =
                e.clientY - this.state.mouseDownOffsetY - canvas.getBoundingClientRect().top;
            newWrapperX =
                parseInt(newWrapperX / this.getPointerDiscretization()) *
                this.getPointerDiscretization();
            newWrapperY =
                parseInt(newWrapperY / this.getPointerDiscretization()) *
                this.getPointerDiscretization();
            this.setState((state) => {
                let nodeDescriptors = [...state.nodeDescriptors];
                let nodeDescriptor = nodeDescriptors.filter(
                    (elm) => parseInt(elm.nodeId) == parseInt(this.state.contentSelectedNodeId)
                );
                if (nodeDescriptor != null && nodeDescriptor.length > 0) {
                    nodeDescriptor = nodeDescriptor[0];
                    nodeDescriptor.display.offsetX = newWrapperX;
                    nodeDescriptor.display.offsetY = newWrapperY;
                    return {
                        ...state,
                        nodeDescriptors: nodeDescriptors
                    };
                }
            });
        } else if (
            this.state.outputSelectedNodeId != null &&
            this.state.outputSelectedNodeId > -1
        ) {
            this.setState({
                currentMouseX: e.clientX - canvas.getBoundingClientRect().left,
                currentMouseY: e.clientY - canvas.getBoundingClientRect().top
            });
        } else if (
            this.state.resizeSelectedNodeId != null &&
            this.state.resizeSelectedNodeId > -1
        ) {
            let currentX = e.clientX - canvas.getBoundingClientRect().left;
            let currentY = e.clientY - canvas.getBoundingClientRect().top;
            let nodeId = this.state.resizeSelectedNodeId;

            let descriptors = this.state.nodeDescriptors;
            let i = 0;
            let newDescriptorList = [];
            for (i = 0; descriptors != null && i < descriptors.length; ++i) {
                let descriptor = descriptors[i];
                if (descriptor.nodeId == nodeId) {
                    let newWidth =
                        parseInt(
                            (currentX - descriptor.display.offsetX) /
                            this.getPointerDiscretization()
                        ) * this.getPointerDiscretization();
                    let newHeight =
                        parseInt(
                            (currentY - descriptor.display.offsetY) /
                            this.getPointerDiscretization()
                        ) * this.getPointerDiscretization();
                    descriptor.display.width = Math.max(32, newWidth);
                    descriptor.display.height = Math.max(32, newHeight);
                    newDescriptorList.push(descriptor);
                } else {
                    newDescriptorList.push(descriptor);
                }
            }
            this.setState({ nodeDescriptors: newDescriptorList });
        } else if (this.state.canvasMoveSelected == 1) {
            let currentX = e.clientX - canvas.getBoundingClientRect().left;
            let currentY = e.clientY - canvas.getBoundingClientRect().top;
            let newOffX = this.state.canvasOffsetX + currentX - this.state.mouseDownX;
            let newOffY = this.state.canvasOffsetY + currentY - this.state.mouseDownY;
            this.setState({
                canvasOffsetX: newOffX,
                canvasOffsetY: newOffY
            });
        }
    };

    canvasmouseup = (e) => {
        let dom = e.target;
        if (this.state.outputSelectedNodeId && this.state.outputSelectedNodeId > -1) {
            if (dom.classList.contains('alweInput')) {
                let closestNodeWrapper = dom.closest('.alweNodeWrapper');
                let inputNodeId = closestNodeWrapper.dataset.nodeId;
                if (inputNodeId != null) {
                    let inputNodeIdx = dom.dataset.idx;
                    if (inputNodeIdx != null) {
                        if (typeof inputNodeIdx == 'string' && inputNodeIdx.startsWith('input_')) {
                            inputNodeIdx = inputNodeIdx.substr(6);
                        }
                        let outputNodeId = this.state.outputSelectedNodeId;
                        let outputNodeIdx = this.state.outputSelectedIdx;
                        this.addOutputInputLinkNodeToState(
                            outputNodeId,
                            outputNodeIdx,
                            inputNodeId,
                            inputNodeIdx
                        );
                    }
                }
            }
        }

        this.setState({
            canvasMoveSelected: -1,
            resizeSelectedNodeId: -1,
            contentSelectedNodeId: -1,
            outputSelectedNodeId: -1,
            outputSelectedIdx: -1,
            currentMouseX: -1,
            currentMouseY: -1,
            mouseDownX: -1,
            mouseDownY: -1
        });
    };

    canvasDoubleClick = (e) => {
        let dom = e.target;
        let closestNodeWrapper = dom.closest('.alweNodeWrapper');
        if (closestNodeWrapper != null) {
            if (this.props.viewOnly) {
                return;
            }
            let doubleClickedNodeId = closestNodeWrapper.dataset.nodeId;
            if (doubleClickedNodeId != null && doubleClickedNodeId > -1) {
                this.setState({
                    editorAreaOpen: true,
                    editorSelectedNodeId: doubleClickedNodeId
                });
            }
        }
    };

    canvasdrop = (e) => {
        if (this.props.viewOnly) {
            return;
        }
        let dom = e.target;
        if (dom.classList.contains('topCanvas')) {
            let ptrX = e.clientX - dom.getBoundingClientRect().left;
            let ptrY = e.clientY - dom.getBoundingClientRect().top;
            e.preventDefault();
            let componentType = e.dataTransfer.getData('componentType');
            if (componentType != null && componentType.length > 0) {
                let componentDescriptor = this.getComponentDescriptor(componentType);
                if (componentDescriptor != null) {
                    let maxNodeId = 0;
                    if (
                        this.state.nodeDescriptors != null &&
                        this.state.nodeDescriptors.length > 0
                    ) {
                        let nodeIdList = this.state.nodeDescriptors.map((elm) => {
                            return elm.nodeId;
                        });
                        maxNodeId = Math.max(...nodeIdList);
                    }
                    let nodeUuid = null;
                    let calledSuppliedUuidFcn = false;
                    if (typeof this.props.uuidGenFcn == 'undefined' || !this.props.uuidGenFcn) {
                        nodeUuid = defaultUuidFcn();
                    } else {
                        nodeUuid = this.props.uuidGenFcn();
                        calledSuppliedUuidFcn = true;
                    }
                    let addNodeDescriptorFcn = (uuidVal) => {
                        let newNodeDescriptor = {
                            nodeId: maxNodeId + 1,
                            nodeUuid: uuidVal,
                            nodeType: componentType,
                            data: componentDescriptor.defaultDataFcn(),
                            numInputs: componentDescriptor.numInputs,
                            numOutputs: componentDescriptor.numOutputs,
                            yesNoOutput: componentDescriptor.yesNoOutput,
                            display: {
                                offsetX: ptrX,
                                offsetY: ptrY,
                                width: componentDescriptor.initialWidthPx,
                                height: componentDescriptor.initialHeightPx
                            }
                        };
                        this.setState({
                            nodeDescriptors: [...this.state.nodeDescriptors, newNodeDescriptor]
                        });
                    };

                    if (calledSuppliedUuidFcn) {
                        if (nodeUuid != null) {
                            if (typeof nodeUuid == 'string') {
                                addNodeDescriptorFcn(nodeUuid);
                            } else {
                                // if it is not a string, assume the nodeUuid is a promise
                                nodeUuid.then((uuidVal) => {
                                    addNodeDescriptorFcn(uuidVal);
                                });
                            }
                        }
                    } else {
                        addNodeDescriptorFcn(nodeUuid);
                    }
                }
            }
        }
    };

    componentContentItemDragStart = (e) => {
        if (this.props.viewOnly) {
            return;
        }
        let dom = e.target;
        if (dom.classList.contains('componentContentItem')) {
            let componentType = dom.dataset.componentType;
            if (
                componentType != null &&
                typeof componentType == 'string' &&
                componentType.length > 0
            ) {
                e.dataTransfer.setData('componentType', componentType);
            }
        }
    };

    /////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////

    addOutputInputLinkNodeToState = (outputNodeId, outputNodeIdx, inputNodeId, inputNodeIdx) => {
        outputNodeId = parseInt(outputNodeId);
        outputNodeIdx = parseInt(outputNodeIdx);
        inputNodeId = parseInt(inputNodeId);
        inputNodeIdx = parseInt(inputNodeIdx);
        let nodeLinkData = [];
        if (this.state.nodeLinks != null) {
            nodeLinkData = [...this.state.nodeLinks];
        }
        let newTuple = [outputNodeId, outputNodeIdx, inputNodeId, inputNodeIdx];
        let exist = nodeLinkData.filter((elm) => {
            return (
                elm[0] == newTuple[0] &&
                elm[1] == newTuple[1] &&
                elm[2] == newTuple[2] &&
                elm[3] == newTuple[3]
            );
        });
        if (exist == null || exist.length == 0) {
            nodeLinkData.push(newTuple);
            this.setState({ nodeLinks: nodeLinkData });
        }
    };

    removeOutputInputLinkToState = (linkage) => {
        if (linkage != null && linkage.length >= 4) {
            let links = [];
            let i = 0;
            for (i = 0; this.state.nodeLinks != null && i < this.state.nodeLinks.length; ++i) {
                let thislink = this.state.nodeLinks[i];
                if (
                    !(
                        thislink[0] == linkage[0] &&
                        thislink[1] == linkage[1] &&
                        thislink[2] == linkage[2] &&
                        thislink[3] == linkage[3]
                    )
                ) {
                    links.push([...thislink]);
                }
            }
            this.setState((state) => {
                return {
                    ...state,
                    nodeLinks: links
                };
            });
        }
    };

    deleteEditorSelectedNodeToState = () => {
        let editorSelectedNodeId = this.state.editorSelectedNodeId;
        if (typeof editorSelectedNodeId == 'undefined' || editorSelectedNodeId == -1) {
            return;
        }
        editorSelectedNodeId = parseInt(editorSelectedNodeId);
        let nodeDescriptors = this.state.nodeDescriptors;
        if (!nodeDescriptors || nodeDescriptors.length == 0) {
            return;
        }
        nodeDescriptors = [...nodeDescriptors];
        let nodeLinks = [...this.state.nodeLinks];
        nodeDescriptors = nodeDescriptors.filter((elm) => {
            return parseInt(elm.nodeId) != editorSelectedNodeId;
        });
        nodeLinks = nodeLinks.filter((elm) => {
            return (
                parseInt(elm[0]) != editorSelectedNodeId && parseInt(elm[2]) != editorSelectedNodeId
            );
        });
        this.setState({
            nodeDescriptors: nodeDescriptors,
            nodeLinks: nodeLinks,
            editorSelectedNodeId: -1,
            editorAreaOpen: false
        });
    };

    setNewDataForNodeIdToState = (nodeId, newNodeData) => {
        let nodeDescriptors = this.state.nodeDescriptors;
        if (!nodeDescriptors || nodeDescriptors.length == 0) {
            return;
        }
        nodeDescriptors = [...nodeDescriptors];
        let i = 0;
        for (i = 0; i < nodeDescriptors.length; ++i) {
            let descriptor = nodeDescriptors[i];
            if (descriptor.nodeId == nodeId) {
                descriptor.data = { ...newNodeData };
                this.setState({
                    nodeDescriptors: nodeDescriptors
                });
                return;
            }
        }
    };

    onComponentSearchTextChange = (e) => {
        if (e.target.value != null) {
            this.setState({ componentSearchText: e.target.value });
        }
    };

    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    getNodeWrapperJsx = (nodeDescriptorData) => {
        let nodeId = nodeDescriptorData.nodeId;
        let nodeType = nodeDescriptorData.nodeType;
        let perNodeData = nodeDescriptorData.data;
        let numInputs = nodeDescriptorData.numInputs;
        let numOutputs = nodeDescriptorData.numOutputs;
        let isYesNoOutput = nodeDescriptorData.yesNoOutput;
        let displayObj = nodeDescriptorData.display;
        let displayOffsetX = displayObj.offsetX;
        let displayOffsetY = displayObj.offsetY;
        let displayContentWrapperWidth = displayObj.width;
        let displayContentWrapperHeight = displayObj.height;
        let contentIsSelected = this.state.contentSelectedNodeId == nodeId;
        let outputSelected =
            this.state.outputSelectedIdx != null &&
            this.state.outputSelectedIdx > -1 &&
            this.state.outputSelectedNodeId == nodeId;
        let outputSelectIdx = this.state.outputSelectedIdx;
        let editorSelectedCssClassName = '';
        if (this.state.editorSelectedNodeId == nodeId) {
            editorSelectedCssClassName = 'editorselected';
        }

        let linksData = this.state.nodeLinks;
        let outputActive = {};
        let inputActive = {};
        let i = 0;
        for (i = 0; linksData != null && i < linksData.length; ++i) {
            let linkage = linksData[i];
            if (linkage[0] == nodeId) {
                outputActive[linkage[1]] = 1;
            }
            if (linkage[2] == nodeId) {
                inputActive[linkage[3]] = 1;
            }
        }

        let inputElements = [];
        for (i = 0; i < numInputs; ++i) {
            let inputElm = null;
            let activeStr = '';
            if (inputActive[i] == 1) {
                activeStr = 'active';
            }
            inputElements.push(
                <div
                    className={`alweInput ${activeStr}`}
                    key={'alweInput_' + i}
                    data-idx={'input_' + i}
                />
            );
        }
        let yesPath = (
            <path fill="black" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
        );
        let noPath = (
            <path
                fill="black"
                d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"
            />
        );
        let outputElements = [];
        for (i = 0; i < numOutputs; ++i) {
            let activeStr = '';
            if ((outputSelected && i == outputSelectIdx) || outputActive[i] == 1) {
                activeStr = 'active';
            }
            if (numOutputs == 2 && isYesNoOutput === true) {
                outputElements.push(
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`alweOutput ${activeStr}`}
                        key={'alweOutput_' + i}
                        data-idx={'output_' + i}
                        viewBox="0 0 24 24">
                        {i == 0 ? yesPath : noPath}
                    </svg>
                );
            } else {
                outputElements.push(
                    <div
                        className={`alweOutput ${activeStr}`}
                        key={'alweOutput_' + i}
                        data-idx={'output_' + i}
                    />
                );
            }
        }

        ///////////////////////////////////
        let contentJsx = (
            <div>{`Cannot render component of type ${nodeType} : component is not registered`}</div>
        );
        let componentRegistry = this.getComponentDescriptor(nodeType);
        if (componentRegistry != null) {
            let ComponentWindow = componentRegistry.componentWindow;
            if (ComponentWindow != null) {
                contentJsx = (
                    <ComponentWindow
                        data={{ ...perNodeData }}
                        updater={this.getDataUpdaterFcnForNodeId(nodeId)}
                        display={{ ...displayObj }}
                    />
                );
            }
        }
        ///////////////////////////////////

        let cursorMoveCss = contentIsSelected === true ? 'cursormove' : '';
        return (
            <div
                className={`alweNodeWrapper ${editorSelectedCssClassName}`}
                key={'alweNodeWrapper_' + nodeId}
                data-node-id={nodeId + ''}
                style={{ left: displayOffsetX + 'px', top: displayOffsetY + 'px' }}>
                <div className={'alweInputs'}>{inputElements}</div>
                <div
                    className={`nodecontent ${cursorMoveCss}`}
                    style={{
                        width: displayContentWrapperWidth + 'px',
                        height: displayContentWrapperHeight + 'px',
                        maxWidth: displayContentWrapperWidth + 'px',
                        maxHeight: displayContentWrapperHeight + 'px'
                    }}>
                    {contentJsx}
                    <div className={'alweResizeBox'} />
                </div>
                <div className={'alweOutputs'}>{outputElements}</div>
            </div>
        );
    };

    getOutputInputLinkSVGs = () => {
        let nodeDescriptors = this.state.nodeDescriptors;
        if (nodeDescriptors == null || nodeDescriptors.length == 0) {
            return null;
        }
        let nodeLinks = this.state.nodeLinks;
        if (nodeLinks == null || nodeLinks.length == 0) {
            return null;
        }
        let i = 0;
        let returnSvgs = [];
        let nodeIdToDescriptor = this.getNodeIdToNodeDescriptor();

        for (i = 0; i < nodeLinks.length; ++i) {
            // nodeLinks[i]: 4 tuple (outNodeId, outNodeOutIdx, inNodeid, inNodeInIdx)
            // outNodeId and inNodeId starts with 0
            const [outNodeId, outNodeIdx, inNodeId, inNodeIdx] = nodeLinks[i];
            //console.log('outNodeId, outNodeIdx, inNodeId, inNodeIdx', outNodeId, outNodeIdx, inNodeId, inNodeIdx);
            let outNodeDisplay = nodeIdToDescriptor[outNodeId].display;
            let numOutStubs = nodeIdToDescriptor[outNodeId].numOutputs;
            let inNodeDisplay = nodeIdToDescriptor[inNodeId].display;
            let numInStubs = nodeIdToDescriptor[inNodeId].numInputs;
            // XXX
            // "15" : in css : .nodewrapper .outputs .output
            //                     .nodewrapper .inputs .input
            let stubWidth = 15;
            let stubHeight = 15;
            // calculate the input/output positions relative to the "canvas"
            let x0 = outNodeDisplay.offsetX + stubWidth * 0.5 + outNodeDisplay.width;
            let y0 =
                0.5 * (outNodeDisplay.height - numOutStubs * stubHeight) +
                stubHeight * outNodeIdx +
                stubHeight * 0.5 +
                outNodeDisplay.offsetY;
            let x1 = inNodeDisplay.offsetX - stubWidth * 0.5;
            let y1 =
                0.5 * (inNodeDisplay.height - numInStubs * stubHeight) +
                stubHeight * inNodeIdx +
                stubHeight * 0.5 +
                inNodeDisplay.offsetY;
            let curveClickDeleteHandler = (e) => {
                this.removeOutputInputLinkToState([outNodeId, outNodeIdx, inNodeId, inNodeIdx]);
            };
            let domSvg = this.getSvgPointAB(
                x0,
                y0,
                x1,
                y1,
                `outlink_${outNodeId}_${outNodeIdx}_${inNodeId}_${inNodeIdx}`,
                curveClickDeleteHandler
            );
            returnSvgs.push(domSvg);
        }
        return returnSvgs;
    };

    getSvgPointAB = (
        x0,
        y0,
        x1,
        y1,
        svgReactElementKey /*optional*/,
        curveClickHandler /*optional*/
    ) => {
        let curvature = 0.5;
        let p = Math.abs(x1 - x0) * curvature;
        let hx1 = x0 + p;
        let hx2 = x1 - p;
        let pathd = `M ${x0} ${y0} C ${hx1} ${y0} ${hx2} ${y1} ${x1} ${y1}`;
        /*
        let isLeftRight = x0 < x1;
        let isTopDown = y0 < y1;
        let width = Math.abs(x0 - x1);
        let height = Math.abs(y0 - y1);
        let isMoreWideThanTall = width > height;

        let pathd = '';
        if (isMoreWideThanTall) {
            if (x1 < x0) {
                [x0, y0, x1, y1] = [x1, y1, x0, y0];
            }
            let p = width * curvature;
            let hx1 = x0 + p;
            let hx2 = x1 - p;
            pathd = `M ${x0} ${y0} C ${hx1} ${y0} ${hx2} ${y1} ${x1} ${y1}`;
        } else {
            if (y1 < y0) {
                [x0, y0, x1, y1] = [x1, y1, x0, y0];
            }
            let p = height * curvature;
            let hy1 = y0 + p;
            let hy2 = y1 - p;
            pathd = `M ${x0} ${y0} C ${x0} ${hy1} ${x1} ${hy2} ${x1} ${y1}`;
        }
*/
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                key={svgReactElementKey}
                onClick={curveClickHandler}>
                <path xmlns="http://www.w3.org/2000/svg" className={'bluePath'} d={pathd} />
            </svg>
        );
    };

    getMagnifyingGlassSvg = (widthPx, heightPx) => {
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width={widthPx + 'px'}
                height={heightPx + 'px'}
                viewBox="0 0 390.704 390.704">
                <path
                    d="M379.711,326.556L265.343,212.188c30.826-54.189,23.166-124.495-23.001-170.663c-55.367-55.366-145.453-55.366-200.818,0
                    c-55.365,55.366-55.366,145.452,0,200.818c46.167,46.167,116.474,53.827,170.663,23.001l114.367,114.369
                    c14.655,14.655,38.503,14.654,53.157,0C394.367,365.059,394.368,341.212,379.711,326.556z M214.057,214.059
                    c-39.77,39.771-104.479,39.771-144.25,0c-39.77-39.77-39.77-104.48,0-144.25c39.771-39.77,104.48-39.77,144.25,0
                    C253.828,109.579,253.827,174.29,214.057,214.059z"
                />
            </svg>
        );
    };

    render() {
        // 1) draw all the nodes on window:
        let jsxNodes =
            this.state.nodeDescriptors != null &&
            this.state.nodeDescriptors.map((descriptor) => {
                return this.getNodeWrapperJsx(descriptor);
            });
        // 2) draw an output activated curve to the current mouse position
        let selectedOutputToCurrentCursorSvg = null;
        if (
            this.state.outputSelectedNodeId != null &&
            this.state.outputSelectedNodeId > -1 &&
            this.state.currentMouseX > -1
        ) {
            selectedOutputToCurrentCursorSvg = this.getSvgPointAB(
                this.state.mouseDownX,
                this.state.mouseDownY,
                this.state.currentMouseX - 1,
                this.state.currentMouseY - 1,
                null,
                null
            );
        }

        // 3) for all existing links, draw the curves
        let outputInputLinkageSvgs = this.getOutputInputLinkSVGs();

        let canvasTransform = null;
        if (this.state.canvasOffsetX != 0 || this.state.canvasOffsetY != 0) {
            canvasTransform = `translate(${this.state.canvasOffsetX}px, ${
                this.state.canvasOffsetY
            }px)`;
        }

        // 4) render the component selector if it is expanded
        let componentAreaOpenCssClassname =
            this.state.componentAreaOpen && !this.props.viewOnly ? 'open' : 'closed';
        let componentAreaJsx = null;
        if (this.state.componentAreaOpen === true && !this.props.viewOnly) {
            let componentRegistry = this.props.componentRegistry;
            let componentFilterJsx = (
                <div key={'componentFilter'} className={`alweComponentFilter`}>
                    {this.getMagnifyingGlassSvg(16, 16)}
                    <input
                        type={'text'}
                        placeholder={'Search'}
                        value={this.state.componentSearchText}
                        onChange={this.onComponentSearchTextChange}
                    />
                </div>
            );
            let componentJsxList = [componentFilterJsx];
            let i = 0;
            let componentNameConsidered = {};
            let searchInputText = this.state.componentSearchText;
            if (searchInputText != null) {
                searchInputText = searchInputText.trim();
            }
            for (i = 0; componentRegistry != null && i < componentRegistry.length; ++i) {
                let registry = componentRegistry[i];
                if (componentNameConsidered[registry.componentTypeName] == 1) {
                    continue;
                }
                let componentSearchText = this.state.componentSearchText;
                if (
                    componentSearchText == null ||
                    componentSearchText.length == 0 ||
                    registry.componentSearchText.indexOf(componentSearchText) >= 0 ||
                    registry.componentTypeName.indexOf(componentSearchText) >= 0
                ) {
                    // filter by component search text if necessary
                    componentNameConsidered[registry.componentTypeName] = 1;
                    let ComponentSelectReactClass = registry.componentSelect;
                    let componentInnerJsx = null;
                    if (
                        typeof ComponentSelectReactClass == 'undefined' ||
                        !ComponentSelectReactClass
                    ) {
                        componentInnerJsx = (
                            <div>{`${registry.componentGroup} - ${
                                registry.componentTypeName
                            }`}</div>
                        );
                    } else {
                        componentInnerJsx = <ComponentSelectReactClass />;
                    }
                    let thisComponentJsx = (
                        <div
                            key={'componentselector_' + i}
                            className={'componentContentItem'}
                            data-component-type={registry.componentTypeName}
                            draggable={'true'}
                            onDragStart={this.componentContentItemDragStart}>
                            {componentInnerJsx}
                        </div>
                    );
                    componentJsxList.push(thisComponentJsx);
                }
            }
            componentAreaJsx = componentJsxList;
        }

        // 5) If a node is selected for edit, render the node's editor:
        let editorAreaOpenCssClassname =
            this.state.editorAreaOpen && !this.props.viewOnly ? 'open' : 'closed';
        let editorComponentJsx = null;
        if (
            this.state.editorAreaOpen === true &&
            this.state.editorSelectedNodeId > -1 &&
            !this.props.viewOnly
        ) {
            let editorNodeIdNodeDescriptor = this.state.nodeDescriptors.filter((elm) => {
                return elm.nodeId == this.state.editorSelectedNodeId;
            });
            if (editorNodeIdNodeDescriptor != null && editorNodeIdNodeDescriptor.length == 1) {
                let componentRegistry = this.getComponentDescriptor(
                    editorNodeIdNodeDescriptor[0].nodeType
                );
                if (componentRegistry != null) {
                    let EditorComponentReactClass = componentRegistry.componentEdit;
                    editorComponentJsx = (
                        <EditorComponentReactClass
                            data={{ ...editorNodeIdNodeDescriptor[0].data }}
                            updater={this.getDataUpdaterFcnForNodeId(
                                editorNodeIdNodeDescriptor[0].nodeId
                            )}
                        />
                    );
                }
            }
        }

        return (
            <div className={'height100'}>
                {/************************************************************** */}
                {/************************************************************** */}
                {/************************************************************** */}

                <div className={`componentArea ${componentAreaOpenCssClassname}`}>
                    {!this.props.viewOnly && (
                        <div
                            className={'closeOpenButton'}
                            onClick={(e) => {
                                this.setState((s) => {
                                    s.componentAreaOpen = !s.componentAreaOpen;
                                    return { ...s };
                                });
                            }}>
                            <div className={`indicator ${componentAreaOpenCssClassname}`}>>></div>
                        </div>
                    )}
                    <div className={`componentContent ${componentAreaOpenCssClassname}`}>
                        {componentAreaJsx}
                    </div>
                </div>

                {/************************************************************** */}
                {/************************************************************** */}
                {/************************************************************** */}

                <div className={`editorArea ${editorAreaOpenCssClassname}`}>
                    <div className={`editorContent ${editorAreaOpenCssClassname}`}>
                        {editorComponentJsx}
                    </div>
                    <div className={`editorClose ${editorAreaOpenCssClassname}`}>
                        <div
                            className={'editorCloseButton'}
                            onClick={(e) => {
                                this.setState((s) => {
                                    s.editorAreaOpen = false;
                                    s.editorSelectedNodeId = -1;
                                    return { ...s };
                                });
                            }}>
                            Close Editor
                        </div>
                        <div
                            className={'editorDeleteButton'}
                            onClick={this.deleteEditorSelectedNodeToState}>
                            Delete
                        </div>
                    </div>
                </div>
                {/************************************************************** */}
                {/************************************************************** */}
                {/************************************************************** */}

                <div
                    className={'topCanvas'}
                    style={{ width: '6900px', height: '6900px', transform: canvasTransform }}
                    onMouseDown={this.canvasmousedown}
                    onMouseUp={this.canvasmouseup}
                    onMouseMove={this.canvasmousemove}
                    onDoubleClick={this.canvasDoubleClick}
                    onDrop={this.canvasdrop}
                    onDragOver={(e) => {
                        e.preventDefault();
                    }}>
                    {outputInputLinkageSvgs}
                    {selectedOutputToCurrentCursorSvg}
                    {jsxNodes}
                </div>
            </div>
        );
    }
}

AlWindowEditor.propTypes = {
    // viewOnly : if true, disables all editing functionalities
    viewOnly: PropTypes.bool,
    // pointerDiscretization : if specified, must be an integer >= 1. This is used to discretize the coordinates
    //      on the main window (so window resize, window move moves in a square grid of this specific size)
    pointerDiscretization: PropTypes.number,

    // initialNodeDescriptors, initialNodeLinks : these are used as initial
    // values for the FlowChartEditor, same as redux's store hydration.
    initialNodeDescriptors: PropTypes.array,
    initialNodeLinks: PropTypes.array,

    /*
    componentRegistry : array of objects
    {
      componentTypeName : string, name of this component
      componentGroup: string, the group for this componentTypeName component. If you don't need component grouping,
                      set this value to something sensible like 'default'
      componentSearchText: string, the component search box will search against this field
      defaultDataFcn : function with no parameter that returns a copy of the default data for this component
      numInputs: integer, the number of input nodes for this component (can be 0, but not negative)
      numOutputs: integer, the number of output nodes for this component (can be 0, but not negative)
      yesNoOutput: true/false (optional). If numOutputs is 2 and yesNoOutput is set to true, renders check, cross
                   mark as the output stub nodes
      initialWidthPx: integer, the default, initial width in pixels when the component is first added
                               to the main window area
      initialHeightPx: integer, same as initialWidthPx, for height
      componentSelect : React component that represents this component in the component selector
                          (optional, if not specified, will just be the "componentType" string)
      componentWindow : React component that represents this component in the main window area
                        Props : "data" : up to date data for the component
                                "updater": function of 1 parameter (the data) to update data
                                "display": JSON representation of where and how big the window is
                                           on the main area. Here is an example of "display":
                                           "display": {
                                                "offsetX": 43.5,
                                                "offsetY": 65,
                                                "width": 136.5,
                                                "height": 103
                                                }
      componentEdit : React component that is displayed to edit the component attributes
                        Props : "data" : up to date data for the component
                                "updater": function of 1 parameter (the data) to update data
    }
    * */
    componentRegistry: PropTypes.array,

    // updateCbkFcn : callback function for when the data of the nodes on the main window area changes
    //                receives 2 parameters : nodeDescriptors, and nodeLinks.
    updateCbkFcn: PropTypes.func,

    uuidGenFcn:
    PropTypes.func /* optional, a no argument function that is capable of generating application unique
    uuid preferbly in v4. The function can return either the UUID string, or a promise.
     If uuidGenFcn is  not supplied, a default implementation is used*/
};

//module.exports = AlWindowEditor;
export default AlWindowEditor;
